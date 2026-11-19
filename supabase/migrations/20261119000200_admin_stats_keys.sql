-- Overview numbers: keeps the flags, disputes, paid creators and domains counts next to the new ones
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
    'open_flags', (select count(*) from public.fraud_flags where status = 'open'),
    'open_disputes', (select count(*) from public.disputes where status in ('open', 'creator_responded')),
    'paid_creators', (select count(*) from public.profiles where plan <> 'free' and (plan_expires_at is null or plan_expires_at > now())),
    'pending_domains', (select count(*) from public.pages where domain_status = 'verified'),
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

