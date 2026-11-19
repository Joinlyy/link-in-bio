-- Super admin workflow: settings access fix, business numbers, creator detail, plan changes with a reason,
-- subscriptions, money, system status, admin login log. Every function checks is_admin() (two-step login).

-- The admin pages could not read app_settings (platform UPI, support contacts): the table had no grant.
-- The row policy still limits it to admins.
grant select on public.app_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Admin sign-ins are logged (once per 30 minutes)
-- ---------------------------------------------------------------------------
create or replace function public.admin_log_login()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.admin_audit where actor_id = auth.uid() and action = 'admin_login' and created_at > now() - interval '30 minutes') then
    perform public.admin_log('admin_login', 'profiles', auth.uid()::text, '{}'::jsonb);
  end if;
end $$;
revoke execute on function public.admin_log_login() from public, anon;
grant execute on function public.admin_log_login() to authenticated;

-- ---------------------------------------------------------------------------
-- Plan changes always carry a reason, and record before and after
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_plan_logged(p_user uuid, p_plan text, p_expires timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  old public.profiles;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Add a reason for this change'; end if;
  select * into old from public.profiles where id = p_user;
  if not found then raise exception 'Creator not found'; end if;
  perform public.admin_set_plan(p_user, p_plan, p_expires);
  perform public.admin_log('plan_changed', 'profiles', p_user::text, jsonb_build_object(
    'email', old.email, 'from_plan', old.plan, 'to_plan', p_plan, 'from_expires', old.plan_expires_at, 'to_expires', p_expires, 'reason', left(trim(p_reason), 300)));
end $$;
revoke execute on function public.admin_set_plan_logged(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.admin_set_plan_logged(uuid, text, timestamptz, text) to authenticated;

create or replace function public.admin_extend_plan(p_user uuid, p_days integer, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  old public.profiles;
  v_new timestamptz;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Add a reason for this change'; end if;
  if p_days is null or p_days < 1 or p_days > 365 then raise exception 'Choose between 1 and 365 days'; end if;
  select * into old from public.profiles where id = p_user;
  if not found then raise exception 'Creator not found'; end if;
  if old.plan = 'free' then raise exception 'This creator is on the free plan. Choose a plan first.'; end if;
  v_new := greatest(coalesce(old.plan_expires_at, now()), now()) + make_interval(days => p_days);
  perform public.admin_set_plan(p_user, old.plan, v_new);
  perform public.admin_log('plan_extended', 'profiles', p_user::text, jsonb_build_object(
    'email', old.email, 'plan', old.plan, 'days', p_days, 'from_expires', old.plan_expires_at, 'to_expires', v_new, 'reason', left(trim(p_reason), 300)));
end $$;
revoke execute on function public.admin_extend_plan(uuid, integer, text) from public, anon;
grant execute on function public.admin_extend_plan(uuid, integer, text) to authenticated;

-- Plans can no longer be changed without a reason
revoke execute on function public.admin_set_plan(uuid, text, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creator list helpers: search by page name, and creators with open flags
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_user_ids(p_q text)
returns uuid[] language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return coalesce((select array_agg(distinct p.owner_id) from public.pages p
    where p.username ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '\_') || '%' or p.display_name ilike '%' || replace(trim(p_q), '%', '') || '%'), '{}');
end $$;
revoke execute on function public.admin_search_user_ids(text) from public, anon;
grant execute on function public.admin_search_user_ids(text) to authenticated;

create or replace function public.admin_flagged_user_ids()
returns uuid[] language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return coalesce((
    select array_agg(distinct p.owner_id) from public.pages p
    where exists (select 1 from public.fraud_flags f where f.page_id = p.id and f.status = 'open')
       or exists (select 1 from public.reports r where r.page_id = p.id and r.status = 'open')
       or exists (select 1 from public.orders o join public.disputes d on d.order_id = o.id where o.page_id = p.id and d.status in ('open', 'creator_responded'))
  ), '{}');
end $$;
revoke execute on function public.admin_flagged_user_ids() from public, anon;
grant execute on function public.admin_flagged_user_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- One creator in full
-- ---------------------------------------------------------------------------
create or replace function public.admin_creator_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'profile', jsonb_build_object('id', pr.id, 'email', pr.email, 'full_name', pr.full_name, 'status', pr.status, 'suspended_reason', pr.suspended_reason,
      'plan', pr.plan, 'plan_expires_at', pr.plan_expires_at, 'created_at', pr.created_at),
    'last_sign_in_at', (select u.last_sign_in_at from auth.users u where u.id = pr.id),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
        'is_published', p.is_published, 'moderation_status', p.moderation_status, 'whatsapp_alerts', coalesce(p.alert_on, false) and p.alert_whatsapp is not null)) from public.pages p where p.owner_id = pr.id), '[]'::jsonb),
    'features', public.plan_features(pr.id),
    'usage', jsonb_build_object(
      'pages', (select count(*) from public.pages p where p.owner_id = pr.id),
      'products', (select count(*) from public.products x join public.pages p on p.id = x.page_id where p.owner_id = pr.id and x.is_published),
      'automations', (select count(*) from public.dm_rules d where d.owner_id = pr.id),
      'dms_this_month', (select count(*) from public.dm_events e where e.owner_id = pr.id and e.status = 'sent' and e.created_at >= date_trunc('month', now()))),
    'instagram', (select jsonb_build_object('username', a.username) from public.instagram_accounts a where a.owner_id = pr.id),
    'sales', (select jsonb_build_object('count', count(*), 'total', coalesce(sum(o.amount_inr), 0)) from public.orders o join public.pages p on p.id = o.page_id where p.owner_id = pr.id and o.status = 'paid'),
    'orders', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select o.id, o.product_title, o.amount_inr, o.status, o.created_at from public.orders o join public.pages p on p.id = o.page_id where p.owner_id = pr.id order by o.created_at desc limit 8) x), '[]'::jsonb),
    'history', jsonb_build_object(
      'refunds', (select count(*) from public.orders o join public.pages p on p.id = o.page_id where p.owner_id = pr.id and o.status = 'refunded'),
      'disputes', (select count(*) from public.disputes d join public.orders o on o.id = d.order_id join public.pages p on p.id = o.page_id where p.owner_id = pr.id),
      'tickets', (select count(*) from public.support_tickets t join public.pages p on p.id = t.page_id where p.owner_id = pr.id),
      'reports', (select count(*) from public.reports rp join public.pages p on p.id = rp.page_id where p.owner_id = pr.id),
      'open_flags', (select count(*) from public.fraud_flags f join public.pages p on p.id = f.page_id where p.owner_id = pr.id and f.status = 'open')),
    'subscriptions', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select s.plan, s.period, s.amount_inr, s.provider, s.created_at, s.ends_at from public.subscriptions s where s.user_id = pr.id order by s.created_at desc limit 8) x), '[]'::jsonb),
    'plan_payments', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select pp.plan, pp.period, pp.amount_inr, pp.status, pp.created_at from public.plan_payments pp where pp.user_id = pr.id order by pp.created_at desc limit 8) x), '[]'::jsonb)
  ) into r from public.profiles pr where pr.id = p_user;
  if r is null then raise exception 'Creator not found'; end if;
  return r;
end $$;
revoke execute on function public.admin_creator_detail(uuid) from public, anon;
grant execute on function public.admin_creator_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Subscriptions: who pays, until when, what failed
-- ---------------------------------------------------------------------------
create or replace function public.admin_subscriptions()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pr.id, 'email', pr.email, 'full_name', pr.full_name, 'plan', pr.plan, 'plan_expires_at', pr.plan_expires_at,
      'active', pr.plan <> 'free' and (pr.plan_expires_at is null or pr.plan_expires_at > now()),
      'last_source', (select s.provider from public.subscriptions s where s.user_id = pr.id order by s.created_at desc limit 1),
      'last_period', (select s.period from public.subscriptions s where s.user_id = pr.id order by s.created_at desc limit 1),
      'paid_total', (select coalesce(sum(pp.amount_inr), 0) from public.plan_payments pp where pp.user_id = pr.id and pp.status = 'approved'),
      'pending', (select count(*) from public.plan_payments pp where pp.user_id = pr.id and pp.status = 'pending'),
      'failed', (select count(*) from public.plan_payments pp where pp.user_id = pr.id and pp.status = 'rejected'),
      'overrides', (select count(*) from public.subscriptions s where s.user_id = pr.id and s.provider = 'admin')
    ) order by pr.plan_expires_at nulls last)
    from public.profiles pr
    where pr.role = 'creator' and (pr.plan <> 'free' or exists (select 1 from public.plan_payments pp where pp.user_id = pr.id))
  ), '[]'::jsonb);
end $$;
revoke execute on function public.admin_subscriptions() from public, anon;
grant execute on function public.admin_subscriptions() to authenticated;

-- ---------------------------------------------------------------------------
-- Money: sales, plan revenue, refunds, commission, top creators; plus extra overview numbers
-- ---------------------------------------------------------------------------
create or replace function public.admin_money()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'gmv_30d', (select coalesce(sum(amount_inr), 0) from public.orders where status = 'paid' and created_at > now() - interval '30 days'),
    'gmv_total', (select coalesce(sum(amount_inr), 0) from public.orders where status = 'paid'),
    'orders_total', (select count(*) from public.orders where status = 'paid'),
    'refunded_total', (select coalesce(sum(amount_inr), 0) from public.orders where status = 'refunded'),
    'refunded_count', (select count(*) from public.orders where status = 'refunded'),
    'open_disputes', (select count(*) from public.disputes where status in ('open', 'creator_responded')),
    -- Direct UPI payments go straight to creators, so commission only exists on payments through our own checkout
    'commission', (select coalesce(round(sum(o.amount_inr * coalesce((public.plan_features(p.owner_id) ->> 'commission_pct')::numeric, 0) / 100)), 0)
                   from public.orders o join public.pages p on p.id = o.page_id where o.status = 'paid' and o.payment_provider not in ('upi', 'test')),
    'plan_revenue_30d', (select coalesce(sum(amount_inr), 0) from public.plan_payments where status = 'approved' and decided_at > now() - interval '30 days'),
    'plan_revenue_total', (select coalesce(sum(amount_inr), 0) from public.plan_payments where status = 'approved'),
    'revenue_daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'sales', s, 'plans', pl) order by d), '[]'::jsonb) from (
        select g::date as d,
          (select coalesce(sum(amount_inr), 0) from public.orders where status = 'paid' and created_at::date = g::date) as s,
          (select coalesce(sum(amount_inr), 0) from public.plan_payments where status = 'approved' and decided_at::date = g::date) as pl
        from generate_series(current_date - 29, current_date, interval '1 day') g) t),
    'top_creators', coalesce((
      select jsonb_agg(x) from (
        select p.username, p.display_name, count(*) as orders, sum(o.amount_inr) as total
        from public.orders o join public.pages p on p.id = o.page_id where o.status = 'paid'
        group by p.username, p.display_name order by sum(o.amount_inr) desc limit 10) x), '[]'::jsonb),
    'dm_30d', jsonb_build_object(
      'sent', (select count(*) from public.dm_events where status = 'sent' and created_at > now() - interval '30 days'),
      'failed', (select count(*) from public.dm_events where status = 'failed' and created_at > now() - interval '30 days'))
  );
end $$;
revoke execute on function public.admin_money() from public, anon;
grant execute on function public.admin_money() to authenticated;

-- ---------------------------------------------------------------------------
-- System status: scheduled jobs, webhooks, alerts
-- ---------------------------------------------------------------------------
create or replace function public.admin_system_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object('name', j.jobname, 'schedule', j.schedule, 'active', j.active,
        'last_status', r.status, 'last_run', r.start_time, 'last_message', left(r.return_message, 160)) order by j.jobname)
      from cron.job j
      left join lateral (select d.status, d.start_time, d.return_message from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) r on true), '[]'::jsonb),
    'http_24h', jsonb_build_object(
      'total', (select count(*) from net._http_response where created > now() - interval '24 hours'),
      'failed', (select count(*) from net._http_response where created > now() - interval '24 hours' and (status_code >= 400 or timed_out or error_msg is not null))),
    'whatsapp_24h', jsonb_build_object(
      'sent', (select count(*) from public.notifications where status = 'sent' and created_at > now() - interval '24 hours'),
      'failed', (select count(*) from public.notifications where status = 'failed' and created_at > now() - interval '24 hours'),
      'skipped', (select count(*) from public.notifications where status = 'skipped' and created_at > now() - interval '24 hours'),
      'last_error', (select left(error, 160) from public.notifications where status = 'failed' order by created_at desc limit 1)),
    'instagram', jsonb_build_object(
      'accounts', (select count(*) from public.instagram_accounts),
      'last_event', (select max(created_at) from public.dm_events),
      'dm_failed_24h', (select count(*) from public.dm_events where status = 'failed' and created_at > now() - interval '24 hours'),
      'last_error', (select left(error, 160) from public.dm_events where status = 'failed' order by created_at desc limit 1)),
    'tickets_not_alerted', (select count(*) from public.support_tickets where created_at > now() - interval '7 days' and (notified ? 'none' or notified::text like '%failed%' or notified::text like '%skipped%'))
  );
end $$;
revoke execute on function public.admin_system_status() from public, anon;
grant execute on function public.admin_system_status() to authenticated;

-- ---------------------------------------------------------------------------
-- From a ticket to the buyer's order page (the order link is private; opening it is logged)
-- ---------------------------------------------------------------------------
create or replace function public.admin_ticket_order_link(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_no bigint;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select o.access_token, t.ticket_no into v_token, v_no from public.support_tickets t join public.orders o on o.id = t.order_id where t.id = p_id;
  if v_token is null then raise exception 'Order not found'; end if;
  perform public.admin_log('opened_order_from_ticket', 'support_tickets', v_no::text);
  return v_token;
end $$;
revoke execute on function public.admin_ticket_order_link(uuid) from public, anon;
grant execute on function public.admin_ticket_order_link(uuid) to authenticated;
