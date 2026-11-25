-- Joinlyy collects every payment (Razorpay Checkout into our own account) and pays creators by hand, minus commission.
-- The creator's payout UPI ID is pages.upi_id. The direct-UPI order flow and the UPI plan payments are removed.

-- ---------------------------------------------------------------------------
-- What we have paid out to creators
-- ---------------------------------------------------------------------------
create table if not exists public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_inr numeric(12, 2) not null check (amount_inr > 0),
  upi_id text,
  reference text,
  note text,
  paid_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists creator_payouts_user_idx on public.creator_payouts (user_id, created_at desc);
alter table public.creator_payouts enable row level security;
drop policy if exists "creator_payouts: own or admin read" on public.creator_payouts;
create policy "creator_payouts: own or admin read" on public.creator_payouts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.creator_payouts from anon, authenticated;
grant select on public.creator_payouts to authenticated;

-- ---------------------------------------------------------------------------
-- Earnings of one creator. A sale counts once it is paid; its share becomes payable 2 days later (time for a refund request).
-- ---------------------------------------------------------------------------
create or replace function public.creator_earnings(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (
    select
      coalesce(sum(o.amount_inr), 0) as gross,
      coalesce(sum(o.commission_inr), 0) as commission,
      coalesce(sum(o.creator_share_inr), 0) as share,
      coalesce(sum(o.creator_share_inr) filter (where o.paid_at <= now() - interval '2 days'), 0) as released,
      count(*) as orders
    from public.orders o join public.pages p on p.id = o.page_id
    where p.owner_id = p_user and o.payment_provider = 'razorpay' and o.status = 'paid'
  ), d as (
    select coalesce(sum(amount_inr), 0) as paid_out from public.creator_payouts where user_id = p_user
  )
  select jsonb_build_object(
    'orders', s.orders, 'gross', s.gross, 'commission', s.commission, 'share', s.share,
    'paid_out', d.paid_out, 'balance', greatest(s.share - d.paid_out, 0),
    'payable_now', greatest(least(s.released, s.share) - d.paid_out, 0),
    'held', greatest(s.share - greatest(s.released, d.paid_out), 0))
  from s, d;
$$;
revoke execute on function public.creator_earnings(uuid) from public, anon, authenticated;

create or replace function public.my_earnings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.creator_earnings(auth.uid());
$$;
grant execute on function public.my_earnings() to authenticated;

-- Admin: everyone who has earned something, or has been paid, or has a payout UPI ID
create or replace function public.admin_creator_earnings()
returns table (user_id uuid, email text, full_name text, username text, upi_id text, upi_name text,
  orders bigint, gross numeric, commission numeric, share numeric, paid_out numeric, balance numeric, payable_now numeric, held numeric,
  last_payout timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select pr.id, pr.email, pr.full_name, pg.username, pg.upi_id, pg.upi_name,
    (e ->> 'orders')::bigint, (e ->> 'gross')::numeric, (e ->> 'commission')::numeric, (e ->> 'share')::numeric,
    (e ->> 'paid_out')::numeric, (e ->> 'balance')::numeric, (e ->> 'payable_now')::numeric, (e ->> 'held')::numeric,
    (select max(cp.created_at) from public.creator_payouts cp where cp.user_id = pr.id)
  from public.profiles pr
  left join public.pages pg on pg.owner_id = pr.id
  cross join lateral (select public.creator_earnings(pr.id) as e) x
  where pr.role = 'creator' and ((e ->> 'orders')::bigint > 0 or (e ->> 'paid_out')::numeric > 0)
  order by (e ->> 'payable_now')::numeric desc, (e ->> 'balance')::numeric desc;
end $$;
grant execute on function public.admin_creator_earnings() to authenticated;

create or replace function public.admin_record_payout(p_user uuid, p_amount numeric, p_reference text, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_balance numeric := (public.creator_earnings(p_user) ->> 'balance')::numeric;
  v_upi text := (select upi_id from public.pages where owner_id = p_user);
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount above zero' using errcode = 'P0001'; end if;
  if round(p_amount, 2) > round(v_balance, 2) then
    raise exception 'That is more than the creator is owed (₹%)', v_balance using errcode = 'P0001';
  end if;
  insert into public.creator_payouts (user_id, amount_inr, upi_id, reference, note, paid_by)
  values (p_user, round(p_amount, 2), v_upi, nullif(trim(p_reference), ''), nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  perform public.admin_log('creator_payout_recorded', 'creator_payouts', v_id::text, jsonb_build_object('user', p_user, 'amount', round(p_amount, 2), 'reference', p_reference));
  perform public.notify_email('creator_payout', v_id::text);
  return v_id;
end $$;
grant execute on function public.admin_record_payout(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Who may sell, and how a page takes money
--   route on and verified  -> 'route'    (split by Razorpay)
--   a payout UPI ID is set -> 'platform' (we collect, we pay the creator)
-- ---------------------------------------------------------------------------
create or replace function public.creator_can_sell(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when coalesce((select route_enabled from public.app_settings where id), false)
      then exists (select 1 from public.payout_accounts where user_id = p_user and status = 'activated')
    else exists (select 1 from public.pages where owner_id = p_user and upi_id is not null)
  end;
$$;
grant execute on function public.creator_can_sell(uuid) to authenticated;

create or replace function public.my_payout_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'route_enabled', coalesce((select route_enabled from public.app_settings where id), false),
    'status', coalesce((select status from public.payout_accounts where user_id = auth.uid()), 'not_started'),
    'has_upi', exists (select 1 from public.pages where owner_id = auth.uid() and upi_id is not null),
    'can_sell', public.creator_can_sell(auth.uid()));
$$;
grant execute on function public.my_payout_status() to authenticated;

create or replace function public.page_payment_mode(p_page_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when coalesce((select route_enabled from public.app_settings where id), false)
         and exists (select 1 from public.pages pg join public.payout_accounts pa on pa.user_id = pg.owner_id
                     where pg.id = p_page_id and pa.status = 'activated') then 'route'
    when (select upi_id from public.pages where id = p_page_id) is not null then 'platform'
    when public.test_payments_on() then 'test'
    else 'off'
  end;
$$;
grant execute on function public.page_payment_mode(uuid) to anon, authenticated;

-- Checkout without the direct-UPI branch
create or replace function public.checkout_order(p_product_id uuid, p_name text, p_email text, p_phone text, p_amount integer default null,
  p_coupon text default null, p_slot timestamptz default null, p_question text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_page uuid := (select page_id from public.products where id = p_product_id);
  v_mode text := public.page_payment_mode((select page_id from public.products where id = p_product_id));
  r jsonb;
begin
  if v_mode = 'test' then
    return public.create_test_order(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
  end if;
  if (select count(*) from public.orders where page_id = v_page and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many orders right now. Please try again in a minute.' using errcode = 'P0001';
  end if;
  r := public.create_test_order_impl(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
  if v_mode = 'off' then
    -- Free things still work; anything with a price waits until the creator has added a payout UPI ID
    if (select amount_inr from public.orders where access_token = r ->> 'token') > 0 then
      raise exception 'This creator hasn’t set up payments yet' using errcode = 'P0001';
    end if;
    return r || jsonb_build_object('razorpay', false);
  end if;
  return public.make_route_pending(r ->> 'token');
end $$;
grant execute on function public.checkout_order(uuid, text, text, text, integer, text, timestamptz, text) to anon, authenticated;

create or replace function public.checkout_tip(p_page_id uuid, p_amount integer, p_name text, p_email text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_mode text := public.page_payment_mode(p_page_id);
  r jsonb;
begin
  if v_mode = 'test' then
    return public.create_test_tip(p_page_id, p_amount, p_name, p_email, p_note);
  end if;
  if v_mode = 'off' then
    raise exception 'This creator hasn’t set up payments yet' using errcode = 'P0001';
  end if;
  if (select count(*) from public.orders where page_id = p_page_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many payments right now. Please try again in a minute.' using errcode = 'P0001';
  end if;
  r := public.create_test_tip_impl(p_page_id, p_amount, p_name, p_email, p_note);
  return public.make_route_pending(r ->> 'token');
end $$;
grant execute on function public.checkout_tip(uuid, integer, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Remove the direct-UPI flow
-- ---------------------------------------------------------------------------
drop function if exists public.make_upi_pending(text);
drop function if exists public.get_upi_payment(text);
drop function if exists public.submit_upi_reference(text, text);
drop function if exists public.confirm_upi_order(uuid);
drop function if exists public.reject_upi_order(uuid, text);
drop function if exists public.plan_payment_info();
drop function if exists public.request_plan_payment(text, text, text);
drop function if exists public.admin_review_plan_payment(uuid, boolean, text);
drop function if exists public.admin_set_platform_upi(text, text);
