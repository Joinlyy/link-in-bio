-- Super admin: support tickets from buyers, business numbers, creator stats and tighter authorization.

-- ---------------------------------------------------------------------------
-- 1. Support tickets. Buyers create them from their order page (through the `support` function);
--    only the admin reads and answers them.
-- ---------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no bigint generated always as identity,
  order_id uuid not null references public.orders (id) on delete cascade,
  page_id uuid references public.pages (id) on delete set null,
  buyer_email text not null,
  buyer_name text,
  buyer_phone text,
  category text not null check (category in ('payment_failed', 'not_received', 'refund', 'creator_issue', 'other')),
  message text not null check (char_length(message) between 5 and 1500),
  priority text not null default 'normal' check (priority in ('high', 'normal')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  admin_reply text check (char_length(admin_reply) <= 2000),
  admin_note text check (char_length(admin_note) <= 2000),
  replied_at timestamptz,
  resolved_at timestamptz,
  notified jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_status_idx on public.support_tickets (status, priority, created_at desc);
create index support_tickets_order_idx on public.support_tickets (order_id);

alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon, authenticated;
create policy "tickets: admin read" on public.support_tickets for select to authenticated using ((select public.is_admin()));
grant select on public.support_tickets to authenticated; -- no insert/update/delete: changes go through the functions below

-- Where new tickets are sent. At least one of the two must be set.
alter table public.app_settings
  add column if not exists support_email text,
  add column if not exists support_whatsapp text;
alter table public.app_settings drop constraint if exists app_settings_support_check;
alter table public.app_settings add constraint app_settings_support_check check (
  (support_email is null or support_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  and (support_whatsapp is null or support_whatsapp ~ '^\d{10,15}$')
);

-- ---------------------------------------------------------------------------
-- 2. Admin actions, each one recorded in the audit log
-- ---------------------------------------------------------------------------
create or replace function public.admin_log(p_action text, p_table text, p_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit (actor_id, action, target_table, target_id, details)
  values (auth.uid(), p_action, p_table, p_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function public.admin_log(text, text, text, jsonb) from public, anon, authenticated;

/** The admin opened buyer details (email, phone): recorded every time */
create or replace function public.admin_log_view(p_what text, p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  perform public.admin_log('viewed_buyer_details', left(p_what, 40), left(p_id, 80));
end $$;
revoke execute on function public.admin_log_view(text, text) from public, anon;
grant execute on function public.admin_log_view(text, text) to authenticated;

create or replace function public.admin_update_ticket(p_id uuid, p_status text, p_reply text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('open', 'in_progress', 'resolved') then raise exception 'Invalid status'; end if;
  select * into t from public.support_tickets where id = p_id for update;
  if not found then raise exception 'Ticket not found'; end if;
  update public.support_tickets set
    status = p_status,
    admin_reply = coalesce(nullif(trim(p_reply), ''), admin_reply),
    replied_at = case when nullif(trim(p_reply), '') is not null and nullif(trim(p_reply), '') is distinct from admin_reply then now() else replied_at end,
    admin_note = nullif(trim(p_note), ''),
    resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) else null end,
    updated_at = now()
  where id = p_id;
  perform public.admin_log('ticket_' || p_status, 'support_tickets', t.ticket_no::text,
    jsonb_build_object('from', t.status, 'to', p_status, 'replied', nullif(trim(p_reply), '') is not null));
end $$;
revoke execute on function public.admin_update_ticket(uuid, text, text, text) from public, anon;
grant execute on function public.admin_update_ticket(uuid, text, text, text) to authenticated;

create or replace function public.admin_set_support_contacts(p_email text, p_whatsapp text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_wa text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if v_wa is not null and length(v_wa) = 10 then v_wa := '91' || v_wa; end if;
  if v_email is null and v_wa is null then raise exception 'Add an email or a WhatsApp number, at least one is required'; end if;
  update public.app_settings set support_email = v_email, support_whatsapp = v_wa where id;
  perform public.admin_log('support_contacts_changed', 'app_settings', 'support', jsonb_build_object('email', v_email is not null, 'whatsapp', v_wa is not null));
end $$;
revoke execute on function public.admin_set_support_contacts(text, text) from public, anon;
grant execute on function public.admin_set_support_contacts(text, text) to authenticated;

/** Suspend or reactivate a creator. Admins can never be suspended this way. */
create or replace function public.admin_set_creator_status(p_user uuid, p_suspended boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.profiles;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into r from public.profiles where id = p_user;
  if not found then raise exception 'Creator not found'; end if;
  if r.role = 'admin' then raise exception 'An admin account can not be suspended'; end if;
  update public.profiles set status = case when p_suspended then 'suspended' else 'active' end,
    suspended_reason = case when p_suspended then left(nullif(trim(p_reason), ''), 300) else null end
  where id = p_user;
end $$;
revoke execute on function public.admin_set_creator_status(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_creator_status(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Buyer view of their own tickets (the order's access token is the credential)
-- ---------------------------------------------------------------------------
create or replace function public.order_support_tickets(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'ticket_no', t.ticket_no, 'category', t.category, 'status', t.status, 'message', t.message,
    'admin_reply', t.admin_reply, 'replied_at', t.replied_at, 'created_at', t.created_at) order by t.created_at desc), '[]'::jsonb)
  from public.support_tickets t join public.orders o on o.id = t.order_id
  where o.access_token = p_token and length(p_token) between 24 and 64;
$$;
revoke execute on function public.order_support_tickets(text) from public;
grant execute on function public.order_support_tickets(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Business numbers for the overview
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'creators', (select count(*) from public.profiles where role = 'creator'),
    'signups_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'pages', (select count(*) from public.pages),
    'published', (select count(*) from public.pages where is_published),
    'suspended', (select count(*) from public.profiles where status = 'suspended'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'instagram_connected', (select count(*) from public.instagram_accounts),
    'leads_7d', (select count(*) from public.leads where created_at > now() - interval '7 days'),
    'views_7d', (select coalesce(sum(views), 0) from public.page_daily where day > current_date - 7),
    'clicks_7d', (select coalesce(sum(clicks), 0) from public.page_daily where day > current_date - 7),
    'gmv_30d', (select coalesce(sum(amount_inr), 0) from public.orders where status = 'paid' and created_at > now() - interval '30 days'),
    'orders_30d', (select count(*) from public.orders where status = 'paid' and created_at > now() - interval '30 days'),
    'gmv_total', (select coalesce(sum(amount_inr), 0) from public.orders where status = 'paid'),
    'orders_total', (select count(*) from public.orders where status = 'paid'),
    'failed_orders_7d', (select count(*) from public.orders where status = 'failed' and created_at > now() - interval '7 days'),
    'products', (select count(*) from public.products where is_published),
    'unread_messages', (select count(*) from public.support_messages where sender = 'creator' and read_at is null),
    'open_tickets', (select count(*) from public.support_tickets where status <> 'resolved'),
    'high_tickets', (select count(*) from public.support_tickets where status <> 'resolved' and priority = 'high'),
    'pending_plan_payments', (select count(*) from public.plan_payments where status = 'pending'),
    'by_plan', (
      select coalesce(jsonb_object_agg(plan_key, n), '{}'::jsonb) from (
        select case when plan <> 'free' and (plan_expires_at is null or plan_expires_at > now()) then plan else 'free' end as plan_key, count(*) as n
        from public.profiles where role = 'creator' group by 1
      ) x
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'signups', s, 'views', v) order by d), '[]')
      from (
        select g::date as d,
          (select count(*) from public.profiles where created_at::date = g::date) as s,
          (select coalesce(sum(views), 0) from public.page_daily where day = g::date) as v
        from generate_series(current_date - 29, current_date, interval '1 day') g
      ) t
    )
  );
end $$;

/** Per-creator numbers for the creators list (admin only) */
create or replace function public.admin_creator_stats(p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pr.id,
      'last_sign_in_at', (select u.last_sign_in_at from auth.users u where u.id = pr.id),
      'avatar_url', (select p.avatar_url from public.pages p where p.owner_id = pr.id order by p.created_at limit 1),
      'sales_count', (select count(*) from public.orders o join public.pages p on p.id = o.page_id where p.owner_id = pr.id and o.status = 'paid'),
      'sales_total', (select coalesce(sum(o.amount_inr), 0) from public.orders o join public.pages p on p.id = o.page_id where p.owner_id = pr.id and o.status = 'paid'),
      'products', (select count(*) from public.products x join public.pages p on p.id = x.page_id where p.owner_id = pr.id and x.is_published),
      'ig_connected', exists (select 1 from public.instagram_accounts a where a.owner_id = pr.id)
    )) from public.profiles pr where pr.id = any (p_ids)
  ), '[]'::jsonb);
end $$;
revoke execute on function public.admin_creator_stats(uuid[]) from public, anon;
grant execute on function public.admin_creator_stats(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Authorization: the API can no longer write role, plan or referral columns at all
--    (the trigger already reset them; this removes the permission as well).
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
