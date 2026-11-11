-- Direct UPI payments.
-- Buyers pay the creator's own UPI ID; the platform never holds money. The buyer enters the
-- 12-digit UPI reference (UTR) and the creator confirms it from their bank app before access opens.
-- Plan upgrades work the same way, paid to the platform's UPI ID and approved by an admin.

-- ---------------------------------------------------------------------------
-- Where money goes
-- ---------------------------------------------------------------------------
alter table public.pages
  add column if not exists upi_id text,
  add column if not exists upi_name text;
alter table public.pages drop constraint if exists pages_upi_id_check;
alter table public.pages add constraint pages_upi_id_check check (upi_id is null or upi_id ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z0-9]{2,64}$');
alter table public.pages drop constraint if exists pages_upi_name_check;
alter table public.pages add constraint pages_upi_name_check check (upi_name is null or char_length(upi_name) <= 80);

alter table public.app_settings
  add column if not exists platform_upi_id text,
  add column if not exists platform_upi_name text;
alter table public.app_settings drop constraint if exists app_settings_upi_check;
alter table public.app_settings add constraint app_settings_upi_check check (platform_upi_id is null or platform_upi_id ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z0-9]{2,64}$');

-- When the buyer said they paid; the UTR itself goes in payment_ref
alter table public.orders add column if not exists payment_submitted_at timestamptz;
grant select (payment_submitted_at) on public.orders to authenticated;

-- ---------------------------------------------------------------------------
-- How a page takes money: its own UPI, test mode, or not yet
-- ---------------------------------------------------------------------------
create or replace function public.page_payment_mode(p_page_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when (select upi_id from public.pages where id = p_page_id) is not null then 'upi'
    when public.test_payments_on() then 'test'
    else 'off'
  end;
$$;
grant execute on function public.page_payment_mode(uuid) to anon, authenticated;

-- Marks a just-created order as waiting for a direct UPI payment (free orders stay paid)
create or replace function public.make_upi_pending(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where access_token = p_token;
  if o.amount_inr > 0 then
    update public.orders set status = 'pending', paid_at = null, payment_provider = 'upi', payment_ref = null where id = o.id;
    return jsonb_build_object('token', p_token, 'upi', true);
  end if;
  return jsonb_build_object('token', p_token, 'upi', false);
end $$;
revoke execute on function public.make_upi_pending(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Checkout: one call for every page. UPI pages create a pending order; others use test mode
-- ---------------------------------------------------------------------------
create or replace function public.checkout_order(p_product_id uuid, p_name text, p_email text, p_phone text, p_amount integer default null,
  p_coupon text default null, p_slot timestamptz default null, p_question text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_page uuid := (select page_id from public.products where id = p_product_id);
  r jsonb;
begin
  if public.page_payment_mode(v_page) = 'test' then
    return public.create_test_order(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
  end if;
  if public.page_payment_mode(v_page) = 'off' then
    -- Free things still work; anything with a price waits until the creator adds a UPI ID
    r := public.create_test_order_impl(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
    if (select amount_inr from public.orders where access_token = r ->> 'token') > 0 then
      raise exception 'This creator hasn’t set up payments yet' using errcode = 'P0001';
    end if;
    return r || jsonb_build_object('upi', false);
  end if;
  if (select count(*) from public.orders where page_id = v_page and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many orders right now. Please try again in a minute.' using errcode = 'P0001';
  end if;
  r := public.create_test_order_impl(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
  return public.make_upi_pending(r ->> 'token');
end $$;
grant execute on function public.checkout_order(uuid, text, text, text, integer, text, timestamptz, text) to anon, authenticated;

create or replace function public.checkout_tip(p_page_id uuid, p_amount integer, p_name text, p_email text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if public.page_payment_mode(p_page_id) = 'test' then
    return public.create_test_tip(p_page_id, p_amount, p_name, p_email, p_note);
  end if;
  if public.page_payment_mode(p_page_id) = 'off' then
    raise exception 'This creator hasn’t set up payments yet' using errcode = 'P0001';
  end if;
  if (select count(*) from public.orders where page_id = p_page_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many payments right now. Please try again in a minute.' using errcode = 'P0001';
  end if;
  r := public.create_test_tip_impl(p_page_id, p_amount, p_name, p_email, p_note);
  return public.make_upi_pending(r ->> 'token');
end $$;
grant execute on function public.checkout_tip(uuid, integer, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The buyer's side: what to pay, and the reference after paying
-- ---------------------------------------------------------------------------
create or replace function public.get_upi_payment(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'upi_id', p.upi_id, 'upi_name', coalesce(nullif(p.upi_name, ''), p.display_name, p.username),
    'amount_inr', o.amount_inr, 'note', 'Order ' || upper(left(o.id::text, 8)),
    'utr', o.payment_ref, 'submitted_at', o.payment_submitted_at, 'status', o.status, 'reason', o.refund_reason)
  from public.orders o join public.pages p on p.id = o.page_id
  where o.access_token = p_token and o.payment_provider = 'upi';
$$;
grant execute on function public.get_upi_payment(text) to anon, authenticated;

create or replace function public.submit_upi_reference(p_token text, p_utr text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_utr text := regexp_replace(coalesce(p_utr, ''), '\s', '', 'g');
begin
  if v_utr !~ '^\d{12}$' then
    raise exception 'The UPI reference is the 12-digit number in your payment app (UTR / UPI Ref No.)' using errcode = 'P0001';
  end if;
  select * into o from public.orders where access_token = p_token and payment_provider = 'upi' for update;
  if not found or o.status <> 'pending' then raise exception 'This order isn’t waiting for a payment' using errcode = 'P0001'; end if;
  if exists (select 1 from public.orders where page_id = o.page_id and payment_ref = v_utr and id <> o.id and status in ('pending', 'paid')) then
    raise exception 'That reference was already used for another order' using errcode = 'P0001';
  end if;
  update public.orders set payment_ref = v_utr, payment_submitted_at = now() where id = o.id;
end $$;
grant execute on function public.submit_upi_reference(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The creator's side: confirm once the money shows in the bank app, or reject
-- ---------------------------------------------------------------------------
create or replace function public.confirm_upi_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or not public.can_edit_page(o.page_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if o.payment_provider <> 'upi' or o.status <> 'pending' then raise exception 'This order isn’t waiting for confirmation' using errcode = 'P0001'; end if;
  update public.orders set status = 'paid', paid_at = now() where id = o.id;
end $$;
grant execute on function public.confirm_upi_order(uuid) to authenticated;

create or replace function public.reject_upi_order(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or not public.can_edit_page(o.page_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if o.payment_provider <> 'upi' or o.status <> 'pending' then raise exception 'This order isn’t waiting for confirmation' using errcode = 'P0001'; end if;
  update public.orders set status = 'failed', refund_reason = left(coalesce(nullif(trim(p_reason), ''), 'Payment not received'), 500) where id = o.id;
  -- Free the slot, the stock and the coupon use it was holding
  update public.bookings set status = 'cancelled', cancel_reason = 'Payment not received' where order_id = o.id and status = 'confirmed';
  if o.product_id is not null then
    update public.products set sales_count = greatest(sales_count - 1, 0) where id = o.product_id;
  end if;
  if o.coupon_code is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where page_id = o.page_id and code = o.coupon_code;
  end if;
end $$;
grant execute on function public.reject_upi_order(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Plan upgrades paid to the platform's UPI and approved by an admin
-- ---------------------------------------------------------------------------
create table if not exists public.plan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null references public.plans (id),
  period text not null check (period in ('month', 'year')),
  amount_inr integer not null check (amount_inr >= 0),
  utr text not null check (utr ~ '^\d{12}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id)
);
create unique index if not exists plan_payments_utr_key on public.plan_payments (utr) where status <> 'rejected';
create index if not exists plan_payments_user_idx on public.plan_payments (user_id, created_at desc);
alter table public.plan_payments enable row level security;
revoke all on public.plan_payments from anon, authenticated;
grant select on public.plan_payments to authenticated;
create policy "plan_payments: own or admin read" on public.plan_payments for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Where to pay for a plan, and any upgrade still waiting for approval
create or replace function public.plan_payment_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'upi_id', s.platform_upi_id, 'upi_name', s.platform_upi_name, 'test_payments', s.test_payments,
    'pending', (select jsonb_build_object('id', pp.id, 'plan', pp.plan, 'period', pp.period, 'amount_inr', pp.amount_inr, 'utr', pp.utr, 'created_at', pp.created_at)
                from public.plan_payments pp where pp.user_id = auth.uid() and pp.status = 'pending' order by pp.created_at desc limit 1),
    'last_rejected', (select jsonb_build_object('plan', pp.plan, 'note', pp.note, 'decided_at', pp.decided_at)
                      from public.plan_payments pp where pp.user_id = auth.uid() and pp.status = 'rejected' and pp.decided_at > now() - interval '7 days'
                      order by pp.decided_at desc limit 1))
  from public.app_settings s where s.id and auth.uid() is not null;
$$;
revoke execute on function public.plan_payment_info() from public, anon;
grant execute on function public.plan_payment_info() to authenticated;

create or replace function public.request_plan_payment(p_plan text, p_period text, p_utr text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pl public.plans;
  v_utr text := regexp_replace(coalesce(p_utr, ''), '\s', '', 'g');
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if (select platform_upi_id from public.app_settings where id) is null then raise exception 'Plan payments aren’t open yet' using errcode = 'P0001'; end if;
  if p_period not in ('month', 'year') then raise exception 'Invalid period' using errcode = 'P0001'; end if;
  select * into pl from public.plans where id = p_plan and is_active and id <> 'free';
  if not found then raise exception 'Plan not available' using errcode = 'P0001'; end if;
  if v_utr !~ '^\d{12}$' then
    raise exception 'The UPI reference is the 12-digit number in your payment app (UTR / UPI Ref No.)' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.plan_payments where user_id = auth.uid() and status = 'pending') then
    raise exception 'You already have a payment waiting for approval' using errcode = 'P0001';
  end if;
  begin
    insert into public.plan_payments (user_id, plan, period, amount_inr, utr)
    values (auth.uid(), pl.id, p_period, case when p_period = 'year' then pl.price_yearly_inr else pl.price_monthly_inr end, v_utr);
  exception when unique_violation then
    raise exception 'That reference was already used' using errcode = 'P0001';
  end;
end $$;
revoke execute on function public.request_plan_payment(text, text, text) from public, anon;
grant execute on function public.request_plan_payment(text, text, text) to authenticated;

create or replace function public.admin_review_plan_payment(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pp public.plan_payments;
  pr public.profiles;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into pp from public.plan_payments where id = p_id for update;
  if not found or pp.status <> 'pending' then raise exception 'This payment was already reviewed' using errcode = 'P0001'; end if;
  update public.plan_payments set status = case when p_approve then 'approved' else 'rejected' end,
    note = left(nullif(trim(p_note), ''), 500), decided_at = now(), decided_by = auth.uid() where id = pp.id;
  if not p_approve then return; end if;
  -- Paying again for the same plan adds the time on top of what's left
  select * into pr from public.profiles where id = pp.user_id;
  v_start := case when pr.plan = pp.plan and pr.plan_expires_at > now() then pr.plan_expires_at else now() end;
  v_end := v_start + case when pp.period = 'year' then interval '1 year' else interval '1 month' end;
  update public.profiles set plan = pp.plan, plan_expires_at = v_end where id = pp.user_id;
  insert into public.subscriptions (user_id, plan, period, amount_inr, provider, starts_at, ends_at)
  values (pp.user_id, pp.plan, pp.period, pp.amount_inr, 'upi', v_start, v_end);
end $$;
revoke execute on function public.admin_review_plan_payment(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_plan_payment(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_platform_upi(p_upi_id text, p_upi_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.app_settings set platform_upi_id = nullif(trim(p_upi_id), ''), platform_upi_name = nullif(trim(p_upi_name), ''), updated_at = now() where id;
end $$;
revoke execute on function public.admin_set_platform_upi(text, text) from public, anon;
grant execute on function public.admin_set_platform_upi(text, text) to authenticated;
