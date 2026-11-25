-- Razorpay Route: buyers pay once, Razorpay splits the money (our commission to Joinlyy, the rest to the creator's bank).
-- Creators must finish KYC (a Razorpay linked account) before they can add or publish anything that costs money.
--
-- The whole thing sits behind app_settings.route_enabled. While it is off (Razorpay has not switched Route on for our
-- account yet) the old direct-UPI flow keeps working and nothing is blocked. Turn it on from Admin, Razorpay.

alter table public.app_settings add column if not exists route_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- A creator's payout (linked) account. We never keep PAN or the full bank account number: they go to Razorpay and no further.
-- ---------------------------------------------------------------------------
create table if not exists public.payout_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  rzp_account_id text unique,
  rzp_stakeholder_id text,
  rzp_product_id text,
  status text not null default 'not_started'
    check (status in ('not_started', 'created', 'needs_clarification', 'under_review', 'activated', 'suspended', 'rejected')),
  legal_name text,
  business_type text,
  phone text,
  bank_last4 text,
  bank_ifsc text,
  beneficiary_name text,
  requirements jsonb not null default '[]'::jsonb,
  reason text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
drop policy if exists "payout_accounts: own or admin read" on public.payout_accounts;
create policy "payout_accounts: own or admin read" on public.payout_accounts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.payout_accounts from anon, authenticated;
grant select (user_id, status, legal_name, business_type, bank_last4, bank_ifsc, beneficiary_name, requirements, reason, activated_at, created_at, updated_at)
  on public.payout_accounts to authenticated;
grant select on public.payout_accounts to authenticated; -- admin reads all columns through RLS

-- ---------------------------------------------------------------------------
-- Who may sell: everyone while Route is off, only creators with an activated account once it is on
-- ---------------------------------------------------------------------------
create or replace function public.creator_can_sell(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not coalesce((select route_enabled from public.app_settings where id), false)
      or exists (select 1 from public.payout_accounts where user_id = p_user and status = 'activated');
$$;
grant execute on function public.creator_can_sell(uuid) to authenticated;

create or replace function public.my_payout_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'route_enabled', coalesce((select route_enabled from public.app_settings where id), false),
    'status', coalesce((select status from public.payout_accounts where user_id = auth.uid()), 'not_started'),
    'can_sell', public.creator_can_sell(auth.uid()));
$$;
grant execute on function public.my_payout_status() to authenticated;

-- Nothing that costs money can be added or switched on before KYC. Free things are never blocked.
create or replace function public.products_require_kyc()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_paid boolean := new.price_inr > 0 or new.pay_what_you_want;
  v_was_paid boolean := tg_op = 'UPDATE' and (old.price_inr > 0 or old.pay_what_you_want);
begin
  if auth.uid() is null or not v_paid then return new; end if; -- server code and free products
  if tg_op = 'UPDATE' and v_was_paid and old.price_inr = new.price_inr and old.pay_what_you_want = new.pay_what_you_want
     and (new.is_published = old.is_published or not new.is_published) then
    return new; -- an edit that does not make anything newly payable
  end if;
  select owner_id into v_owner from public.pages where id = new.page_id;
  if not public.creator_can_sell(v_owner) then
    raise exception 'Finish your payout KYC first (Settings, Payouts). Paid products need a verified payout account.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists products_require_kyc on public.products;
create trigger products_require_kyc before insert or update on public.products for each row execute function public.products_require_kyc();

-- ---------------------------------------------------------------------------
-- Orders paid through Razorpay
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists rzp_order_id text,
  add column if not exists commission_pct numeric(5, 2),
  add column if not exists commission_inr numeric(10, 2),
  add column if not exists creator_share_inr numeric(10, 2);
create unique index if not exists orders_rzp_order_idx on public.orders (rzp_order_id) where rzp_order_id is not null;
grant select (rzp_order_id, commission_pct, commission_inr, creator_share_inr) on public.orders to authenticated;

-- How a page takes money: Route when it is on and the creator is verified; the old way while Route is off
create or replace function public.page_payment_mode(p_page_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when coalesce((select route_enabled from public.app_settings where id), false) then
      case
        when exists (select 1 from public.pages pg join public.payout_accounts pa on pa.user_id = pg.owner_id
                     where pg.id = p_page_id and pa.status = 'activated') then 'route'
        when public.test_payments_on() then 'test'
        else 'off'
      end
    when (select upi_id from public.pages where id = p_page_id) is not null then 'upi'
    when public.test_payments_on() then 'test'
    else 'off'
  end;
$$;
grant execute on function public.page_payment_mode(uuid) to anon, authenticated;

-- Marks a just-created order as waiting for a Razorpay payment (free orders stay paid)
create or replace function public.make_route_pending(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where access_token = p_token;
  if o.amount_inr > 0 then
    update public.orders set status = 'pending', paid_at = null, payment_provider = 'razorpay', payment_ref = null where id = o.id;
    return jsonb_build_object('token', p_token, 'razorpay', true);
  end if;
  return jsonb_build_object('token', p_token, 'razorpay', false);
end $$;
revoke execute on function public.make_route_pending(text) from public, anon, authenticated;

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
  if v_mode = 'off' then
    -- Free things still work; anything with a price waits until the creator is set up for payments
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
  if v_mode = 'route' then return public.make_route_pending(r ->> 'token'); end if;
  return public.make_upi_pending(r ->> 'token');
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
  if v_mode = 'route' then return public.make_route_pending(r ->> 'token'); end if;
  return public.make_upi_pending(r ->> 'token');
end $$;
grant execute on function public.checkout_tip(uuid, integer, text, text, text) to anon, authenticated;

-- Failed or abandoned Razorpay orders free their stock and coupon like a rejected UPI order does (called by the server)
create or replace function public.route_fail_order(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.payment_provider <> 'razorpay' or o.status <> 'pending' then return; end if;
  update public.orders set status = 'failed', refund_reason = left(coalesce(nullif(trim(p_reason), ''), 'Payment not completed'), 500) where id = o.id;
  update public.bookings set status = 'cancelled', cancel_reason = 'Payment not completed' where order_id = o.id and status = 'confirmed';
  if o.product_id is not null then
    update public.products set sales_count = greatest(sales_count - 1, 0) where id = o.product_id;
  end if;
  if o.coupon_code is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where page_id = o.page_id and code = o.coupon_code;
  end if;
end $$;
revoke execute on function public.route_fail_order(uuid, text) from public, anon, authenticated;

-- Admin: switch Route on or off
create or replace function public.admin_set_route(p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.app_settings set route_enabled = p_on where id;
  perform public.admin_log('route_enabled', 'app_settings', 'true', jsonb_build_object('on', p_on));
end $$;
grant execute on function public.admin_set_route(boolean) to authenticated;
