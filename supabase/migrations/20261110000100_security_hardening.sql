-- Security hardening (audit of 2026-11-10). Backward compatible: no data is changed or removed.

-- ---------------------------------------------------------------------------
-- 1. Test-mode payments can be switched off before launch
--    While on (the default, as today), checkout, tips, upsells and plan upgrades
--    succeed without money. Turn it off in production until Razorpay is live:
--      update public.app_settings set test_payments = false;
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  test_payments boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (true) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
create policy "app_settings: admin read" on public.app_settings for select to authenticated using ((select public.is_admin()));

create or replace function public.test_payments_on()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select test_payments from public.app_settings where id), false);
$$;

create or replace function public.require_test_payments()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.test_payments_on() then
    raise exception 'Payments aren’t open yet. Please try again later.' using errcode = 'P0001';
  end if;
end $$;
revoke execute on function public.require_test_payments() from public, anon, authenticated;
revoke execute on function public.test_payments_on() from public, anon, authenticated;

-- Wrap the four money-free paths without touching their logic
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_test_order(uuid, text, text, text, integer, text, timestamptz, text)',
    'public.create_test_tip(uuid, integer, text, text, text)',
    'public.accept_upsell(text)',
    'public.test_upgrade(text, text)'
  ] loop
    execute format('alter function %s rename to %I', fn, split_part(split_part(fn, '.', 2), '(', 1) || '_impl');
  end loop;
end $$;

create or replace function public.create_test_order(p_product_id uuid, p_name text, p_email text, p_phone text, p_amount integer default null,
  p_coupon text default null, p_slot timestamptz default null, p_question text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_test_payments();
  -- A page can't be flooded with fake orders
  if (select count(*) from public.orders o join public.products pr on pr.page_id = o.page_id
       where pr.id = p_product_id and o.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many orders right now. Please try again in a minute.' using errcode = 'P0001';
  end if;
  return public.create_test_order_impl(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
end $$;

create or replace function public.create_test_tip(p_page_id uuid, p_amount integer, p_name text, p_email text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_test_payments();
  if (select count(*) from public.orders where page_id = p_page_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many payments right now. Please try again in a minute.' using errcode = 'P0001';
  end if;
  return public.create_test_tip_impl(p_page_id, p_amount, p_name, p_email, p_note);
end $$;

create or replace function public.accept_upsell(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_test_payments();
  return public.accept_upsell_impl(p_token);
end $$;

create or replace function public.test_upgrade(p_plan text, p_period text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_test_payments();
  return public.test_upgrade_impl(p_plan, p_period);
end $$;

revoke execute on function public.create_test_order_impl(uuid, text, text, text, integer, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.create_test_tip_impl(uuid, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.accept_upsell_impl(text) from public, anon, authenticated;
revoke execute on function public.test_upgrade_impl(text, text) from public, anon, authenticated;
grant execute on function public.create_test_order(uuid, text, text, text, integer, text, timestamptz, text) to anon, authenticated;
grant execute on function public.create_test_tip(uuid, integer, text, text, text) to anon, authenticated;
grant execute on function public.accept_upsell(text) to anon, authenticated;
revoke execute on function public.test_upgrade(text, text) from public, anon;
grant execute on function public.test_upgrade(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Suspended accounts lose access on the server, not only in the app
-- ---------------------------------------------------------------------------
create or replace function public.page_role(p_page_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then null
    when exists (select 1 from public.pages where id = p_page_id and owner_id = auth.uid()) then 'owner'
    else (select role from public.page_members where page_id = p_page_id and user_id = auth.uid() and accepted_at is not null)
  end;
$$;

-- Own-page rules that don't go through page_role
drop policy if exists "pages: insert own" on public.pages;
create policy "pages: insert own" on public.pages for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
drop policy if exists "pages: delete own" on public.pages;
create policy "pages: delete own" on public.pages for delete to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));
drop policy if exists "dm_rules: owner all" on public.dm_rules;
create policy "dm_rules: owner all" on public.dm_rules for all to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active'));

-- Storage: a suspended creator can't upload or change files either
create or replace function public.can_write_owner_folder(p_folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
     and (p_folder = auth.uid()::text
          or exists (select 1 from public.pages p where p.owner_id::text = p_folder and public.can_edit_page(p.id)));
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;
drop policy if exists "creator-images: owner insert" on storage.objects;
create policy "creator-images: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'creator-images' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_active_user()));
drop policy if exists "creator-images: owner update" on storage.objects;
create policy "creator-images: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'creator-images' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_active_user()));

-- ---------------------------------------------------------------------------
-- 3. Buyers' order links stay with the buyer
--    access_token opens the buyer's order page (downloads, bookings, disputes).
--    Creators and the dashboard never need it, so the API can't read it.
-- ---------------------------------------------------------------------------
revoke select on public.orders from authenticated;
grant select (id, page_id, product_id, kind, product_title, product_type, buyer_name, buyer_email, buyer_phone, note, amount_inr,
  discount_inr, coupon_code, status, payment_provider, payment_ref, downloads, created_at, paid_at, question, answer, answered_at,
  access_expires_at, refunded_at, refund_reason, refunded_by, upsell_of) on public.orders to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Support messages: a creator can only mark replies as read
-- ---------------------------------------------------------------------------
revoke update on public.support_messages from authenticated;
grant update (read_at) on public.support_messages to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admin actions need two-step login (MFA). Admins enrol in Settings first.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

-- ---------------------------------------------------------------------------
-- 6. Flood limits on public forms (per page, server side)
-- ---------------------------------------------------------------------------
alter function public.submit_lead(uuid, uuid, text, text, text, boolean, text) rename to submit_lead_impl;
create or replace function public.submit_lead(p_page_id uuid, p_block_id uuid, p_name text, p_email text, p_phone text, p_consent boolean, p_consent_text text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.leads where page_id = p_page_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many sign-ups right now. Please try again in a minute.' using errcode = 'P0001';
  end if;
  perform public.submit_lead_impl(p_page_id, p_block_id, p_name, p_email, p_phone, p_consent, p_consent_text);
end $$;
revoke execute on function public.submit_lead_impl(uuid, uuid, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.submit_lead(uuid, uuid, text, text, text, boolean, text) to anon, authenticated;

alter function public.submit_enquiry(uuid, text, text, text, text, text, text, text) rename to submit_enquiry_impl;
create or replace function public.submit_enquiry(p_page_id uuid, p_brand text, p_name text, p_email text, p_phone text, p_budget text,
  p_message text, p_deal_type text default 'paid')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.enquiries where page_id = p_page_id and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Too many enquiries right now. Please try again later.' using errcode = 'P0001';
  end if;
  perform public.submit_enquiry_impl(p_page_id, p_brand, p_name, p_email, p_phone, p_budget, p_message, p_deal_type);
end $$;
revoke execute on function public.submit_enquiry_impl(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_enquiry(uuid, text, text, text, text, text, text, text) to anon, authenticated;

-- Reports: only real reasons, and one person can't flood a page
create or replace function public.report_page(p_page_id uuid, p_reason text, p_details text, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.pages where id = p_page_id) then
    raise exception 'Page not found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reports where page_id = p_page_id and created_at > now() - interval '1 minute') > 20 then
    return; -- silently drop floods
  end if;
  insert into public.reports (page_id, reason, details, reporter_email)
  values (p_page_id, p_reason, left(p_details, 1000), left(nullif(trim(p_email), ''), 200));
end $$;

-- ---------------------------------------------------------------------------
-- 7. Least privilege on tables. RLS never applies to TRUNCATE, so no API role keeps it.
--    anon reads only what public RPCs return, plus the plan list.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on public.plans from anon;
grant select on public.plans to anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Fixed search_path on the last two functions without one
-- ---------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = '';
alter function public.url_host(text) set search_path = '';

-- ---------------------------------------------------------------------------
-- 9. Usernames that clash with app routes and public files
-- ---------------------------------------------------------------------------
insert into public.reserved_usernames (username) values
  ('academy'), ('invoices'), ('invoice'), ('p'), ('account'), ('billing'), ('preview'), ('embed'), ('callback'),
  ('sw.js'), ('robots.txt'), ('sitemap.xml'), ('favicon.svg'), ('favicon.ico'), ('manifest.webmanifest'), ('icons'),
  ('moderator'), ('linkinbio'), ('webhook'), ('webhooks'), ('cdn'), ('assets2'), ('edge'), ('functions')
on conflict do nothing;
