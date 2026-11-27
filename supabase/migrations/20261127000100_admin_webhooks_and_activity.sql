-- Super admin: every Razorpay webhook result in one searchable list, and a 3-day feed of what creators did.

-- ---------------------------------------------------------------------------
-- Webhooks: one row per event with the useful facts pulled out of the payload
-- ---------------------------------------------------------------------------
create or replace function public.admin_webhook_events(
  p_status text default null, p_event text default null, p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id bigint, event_id text, event text, status text, attempts integer, error text, received_at timestamptz, processed_at timestamptz,
  payment_id text, order_id text, subscription_id text, amount_inr numeric, method text, who text, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  with ev as (
    select e.id, e.event_id, e.event, e.status, e.attempts, e.error, e.received_at, e.processed_at,
      e.payload #>> '{payload,payment,entity,id}' as payment_id,
      coalesce(e.payload #>> '{payload,payment,entity,order_id}', e.payload #>> '{payload,order,entity,id}') as order_id,
      coalesce(e.payload #>> '{payload,subscription,entity,id}', e.payload #>> '{payload,payment,entity,subscription_id}') as subscription_id,
      (coalesce(e.payload #>> '{payload,payment,entity,amount}', e.payload #>> '{payload,refund,entity,amount}', e.payload #>> '{payload,order,entity,amount}'))::numeric / 100 as amount_inr,
      e.payload #>> '{payload,payment,entity,method}' as method
    from public.razorpay_events e
  ), j as (
    select ev.*,
      coalesce(
        (select 'Plan: ' || pr.email from public.billing_subscriptions bs join public.profiles pr on pr.id = bs.user_id where bs.rzp_subscription_id = ev.subscription_id limit 1),
        (select 'Sale: ' || coalesce(pg.display_name, pg.username) || ' (' || o.buyer_email || ')' from public.orders o join public.pages pg on pg.id = o.page_id where o.rzp_order_id = ev.order_id limit 1),
        (select 'Payout account: ' || coalesce(pa.legal_name, pr.email) from public.payout_accounts pa join public.profiles pr on pr.id = pa.user_id
           where pa.rzp_account_id = coalesce(ev.event_id, '') limit 1)
      ) as who
    from ev
  )
  select j.id, j.event_id, j.event, j.status, j.attempts, j.error, j.received_at, j.processed_at, j.payment_id, j.order_id, j.subscription_id, j.amount_inr, j.method, j.who,
    count(*) over () as total_count
  from j
  where (p_status is null or p_status = '' or j.status = p_status or (p_status = 'problems' and j.status in ('failed', 'received')))
    and (p_event is null or p_event = '' or j.event = p_event)
    and (p_search is null or p_search = '' or j.event_id ilike '%' || p_search || '%' or j.payment_id ilike '%' || p_search || '%' or j.order_id ilike '%' || p_search || '%'
         or j.subscription_id ilike '%' || p_search || '%' or j.who ilike '%' || p_search || '%' or j.error ilike '%' || p_search || '%')
  order by j.received_at desc, j.id desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;
revoke execute on function public.admin_webhook_events(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_webhook_events(text, text, text, integer, integer) to authenticated;

create or replace function public.admin_webhook_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.razorpay_events),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.razorpay_events group by 1) s), '{}'::jsonb),
    'last_24h', (select count(*) from public.razorpay_events where received_at > now() - interval '24 hours'),
    'last_received', (select max(received_at) from public.razorpay_events),
    'events', coalesce((select jsonb_agg(event order by event) from (select distinct event from public.razorpay_events) d), '[]'::jsonb));
end $$;
revoke execute on function public.admin_webhook_summary() from public, anon;
grant execute on function public.admin_webhook_summary() to authenticated;

-- ---------------------------------------------------------------------------
-- What creators did in the last few days
-- ---------------------------------------------------------------------------
create or replace function public.admin_recent_activity(p_days integer default 3, p_limit integer default 300)
returns table (at timestamptz, kind text, user_id uuid, creator text, email text, username text, summary text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_since timestamptz := now() - make_interval(days => least(greatest(p_days, 1), 30));
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  with feed as (
    select pr.created_at as at, 'signup'::text as kind, pr.id as uid, 'Signed up'::text as summary
      from public.profiles pr where pr.role = 'creator' and pr.created_at >= v_since
    union all
    select pg.published_at, 'page_live', pg.owner_id, 'Published their page /' || pg.username
      from public.pages pg where pg.published_at >= v_since
    union all
    select p.created_at, 'product', p.owner_id, 'Added ' || p.type || ' "' || coalesce(nullif(p.title, ''), 'untitled') || '"' || case when p.price_inr > 0 then ' at ₹' || p.price_inr else ' (free)' end
      from public.products p where p.created_at >= v_since and p.type <> 'link'
    union all
    select o.paid_at, 'sale', pg.owner_id, 'Sale of ₹' || o.amount_inr || ': ' || coalesce(nullif(o.product_title, ''), case when o.kind = 'tip' then 'Tip' else 'Order' end)
      from public.orders o join public.pages pg on pg.id = o.page_id where o.status = 'paid' and o.paid_at >= v_since and o.payment_provider <> 'test'
    union all
    select b.paid_at, 'plan', b.user_id, 'Paid ₹' || b.amount_inr || ' for a plan'
      from public.billing_payments b where b.status = 'captured' and b.paid_at >= v_since
    union all
    select c.created_at, 'payout', c.user_id, 'Was paid ₹' || c.amount_inr || ' by you' || coalesce(' (ref ' || c.reference || ')', '')
      from public.creator_payouts c where c.created_at >= v_since
    union all
    select a.connected_at, 'instagram', a.owner_id, 'Connected Instagram @' || coalesce(a.username, '?')
      from public.instagram_accounts a where a.connected_at >= v_since
    union all
    select s.created_at, 'post', s.owner_id, 'Scheduled a ' || lower(s.media_type) || ' post for ' || to_char(s.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon HH12:MI AM')
      from public.ig_scheduled_posts s where s.created_at >= v_since
    union all
    select s.published_at, 'post_live', s.owner_id, 'Instagram ' || lower(s.media_type) || ' post went live'
      from public.ig_scheduled_posts s where s.published_at >= v_since
    union all
    select r.created_at, 'automation', r.owner_id, 'Created DM automation "' || r.name || '"'
      from public.dm_rules r where r.created_at >= v_since
    union all
    select t.created_at, 'support', pg.owner_id, 'Support request from a buyer: ' || left(t.message, 80)
      from public.support_tickets t join public.pages pg on pg.id = t.page_id where t.created_at >= v_since
    union all
    select d.created_at, 'dispute', pg.owner_id, 'A buyer opened a dispute'
      from public.disputes d join public.pages pg on pg.id = d.page_id where d.created_at >= v_since
  )
  select f.at, f.kind, f.uid, coalesce(nullif(pr.full_name, ''), pr.email), pr.email,
    (select pg.username from public.pages pg where pg.owner_id = f.uid limit 1), f.summary
  from feed f left join public.profiles pr on pr.id = f.uid
  where f.at is not null
  order by f.at desc
  limit least(greatest(p_limit, 1), 1000);
end $$;
revoke execute on function public.admin_recent_activity(integer, integer) from public, anon;
grant execute on function public.admin_recent_activity(integer, integer) to authenticated;
