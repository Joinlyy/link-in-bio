-- Clear split of every sale: what the buyer paid, our platform charge, what the creator receives. Today and all time.

create or replace function public.creator_earnings(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (
    select
      coalesce(sum(o.amount_inr), 0) as gross,
      coalesce(sum(o.commission_inr), 0) as commission,
      coalesce(sum(o.creator_share_inr), 0) as share,
      coalesce(sum(o.creator_share_inr) filter (where o.paid_at <= now() - interval '2 days'), 0) as released,
      count(*) as orders,
      coalesce(sum(o.amount_inr) filter (where (o.paid_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date), 0) as today_gross,
      coalesce(sum(o.commission_inr) filter (where (o.paid_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date), 0) as today_commission,
      coalesce(sum(o.creator_share_inr) filter (where (o.paid_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date), 0) as today_share,
      count(*) filter (where (o.paid_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date) as today_orders
    from public.orders o join public.pages p on p.id = o.page_id
    where p.owner_id = p_user and o.payment_provider = 'razorpay' and o.status = 'paid'
  ), d as (
    select coalesce(sum(amount_inr), 0) as paid_out from public.creator_payouts where user_id = p_user
  )
  select jsonb_build_object(
    'orders', s.orders, 'gross', s.gross, 'commission', s.commission, 'share', s.share,
    'paid_out', d.paid_out, 'balance', greatest(s.share - d.paid_out, 0),
    'payable_now', greatest(least(s.released, s.share) - d.paid_out, 0),
    'held', greatest(s.share - greatest(s.released, d.paid_out), 0),
    'today_orders', s.today_orders, 'today_gross', s.today_gross, 'today_commission', s.today_commission, 'today_share', s.today_share)
  from s, d;
$$;
revoke execute on function public.creator_earnings(uuid) from public, anon, authenticated;

drop function if exists public.admin_creator_earnings();
create or replace function public.admin_creator_earnings()
returns table (user_id uuid, email text, full_name text, username text, upi_id text, upi_name text,
  orders bigint, gross numeric, commission numeric, share numeric, paid_out numeric, balance numeric, payable_now numeric, held numeric,
  today_gross numeric, today_commission numeric, today_share numeric, last_payout timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select pr.id, pr.email, pr.full_name, pg.username, pg.upi_id, pg.upi_name,
    (e ->> 'orders')::bigint, (e ->> 'gross')::numeric, (e ->> 'commission')::numeric, (e ->> 'share')::numeric,
    (e ->> 'paid_out')::numeric, (e ->> 'balance')::numeric, (e ->> 'payable_now')::numeric, (e ->> 'held')::numeric,
    (e ->> 'today_gross')::numeric, (e ->> 'today_commission')::numeric, (e ->> 'today_share')::numeric,
    (select max(cp.created_at) from public.creator_payouts cp where cp.user_id = pr.id)
  from public.profiles pr
  left join public.pages pg on pg.owner_id = pr.id
  cross join lateral (select public.creator_earnings(pr.id) as e) x
  where pr.role = 'creator' and ((e ->> 'orders')::bigint > 0 or (e ->> 'paid_out')::numeric > 0)
  order by (e ->> 'payable_now')::numeric desc, (e ->> 'balance')::numeric desc;
end $$;
grant execute on function public.admin_creator_earnings() to authenticated;

-- Admin: every paid sale with its split, newest first
create or replace function public.admin_sales_ledger(p_limit integer default 300)
returns table (order_id uuid, paid_at timestamptz, creator_email text, creator_name text, username text, item text,
  buyer_paid numeric, commission_pct numeric, platform_charge numeric, creator_gets numeric, razorpay_payment text, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select o.id, o.paid_at, pr.email, pr.full_name, pg.username, coalesce(o.product_title, case when o.kind = 'tip' then 'Tip' else 'Order' end),
    o.amount_inr::numeric, o.commission_pct, o.commission_inr, o.creator_share_inr, o.payment_ref, o.status
  from public.orders o join public.pages pg on pg.id = o.page_id join public.profiles pr on pr.id = pg.owner_id
  where o.payment_provider = 'razorpay' and o.status in ('paid', 'refunded')
  order by o.paid_at desc nulls last
  limit least(greatest(p_limit, 1), 1000);
end $$;
grant execute on function public.admin_sales_ledger(integer) to authenticated;
