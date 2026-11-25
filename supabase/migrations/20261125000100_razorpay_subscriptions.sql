-- Razorpay subscriptions (Phase 1): creators pay Joinlyy for the Creator and Pro plans, with auto-renew.
-- Razorpay is the source of truth. Nothing here trusts the browser: a plan switches on only from a verified Razorpay
-- message or from a server-side check of Razorpay's own records, and every charge is applied exactly once.

-- ---------------------------------------------------------------------------
-- Razorpay plans created for our prices (Razorpay plans can't be edited, so a new price means a new plan)
-- ---------------------------------------------------------------------------
create table public.razorpay_plans (
  id uuid primary key default gen_random_uuid(),
  plan text not null references public.plans (id) on update cascade,
  period text not null check (period in ('month', 'year')),
  mode text not null check (mode in ('test', 'live')),
  amount_paise integer not null check (amount_paise > 0),
  rzp_plan_id text not null unique,
  created_at timestamptz not null default now(),
  unique (plan, period, mode, amount_paise)
);

-- ---------------------------------------------------------------------------
-- One row per Razorpay subscription
-- ---------------------------------------------------------------------------
create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null references public.plans (id) on update cascade,
  period text not null check (period in ('month', 'year')),
  mode text not null default 'test' check (mode in ('test', 'live')),
  rzp_subscription_id text unique,
  rzp_plan_id text,
  status text not null default 'created' check (status in ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'paused', 'expired')),
  cancel_at_cycle_end boolean not null default false,
  base_inr numeric(10, 2) not null check (base_inr > 0),
  gst_inr numeric(10, 2) not null check (gst_inr >= 0),
  total_inr numeric(10, 2) not null check (total_inr > 0),
  paid_count integer not null default 0,
  current_start timestamptz,
  current_end timestamptz,
  next_charge_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billing_subscriptions_user_idx on public.billing_subscriptions (user_id, created_at desc);
create index billing_subscriptions_status_idx on public.billing_subscriptions (status, updated_at);

-- ---------------------------------------------------------------------------
-- Every payment attempt Razorpay tells us about
-- ---------------------------------------------------------------------------
create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.billing_subscriptions (id) on delete set null,
  rzp_payment_id text not null unique,
  rzp_invoice_id text,
  status text not null check (status in ('authorized', 'captured', 'failed', 'refunded')),
  amount_inr numeric(10, 2) not null,
  base_inr numeric(10, 2) not null default 0,
  gst_inr numeric(10, 2) not null default 0,
  method text,
  error text,
  period_end timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index billing_payments_user_idx on public.billing_payments (user_id, created_at desc);
create index billing_payments_sub_idx on public.billing_payments (subscription_id);

-- ---------------------------------------------------------------------------
-- Every webhook, stored as received. Unique by Razorpay's event id, so repeats are ignored; failed ones can be replayed.
-- ---------------------------------------------------------------------------
create table public.razorpay_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  event text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error text,
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index razorpay_events_received_idx on public.razorpay_events (received_at desc);
create index razorpay_events_status_idx on public.razorpay_events (status, received_at);

-- ---------------------------------------------------------------------------
-- Things that need a human: amounts that don't match, payments we can't place, paid but not applied
-- ---------------------------------------------------------------------------
create table public.billing_issues (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  user_id uuid references public.profiles (id) on delete set null,
  subscription_id uuid references public.billing_subscriptions (id) on delete set null,
  rzp_payment_id text,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index billing_issues_dedupe on public.billing_issues (kind, coalesce(rzp_payment_id, ''), coalesce(subscription_id::text, '')) where status = 'open';

-- Row access: creators read only their own subscription and payments; admins read everything; nobody writes from the API
alter table public.razorpay_plans enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.razorpay_events enable row level security;
alter table public.billing_issues enable row level security;
revoke all on public.razorpay_plans, public.billing_subscriptions, public.billing_payments, public.razorpay_events, public.billing_issues from anon, authenticated;
create policy "billing_subscriptions: owner or admin read" on public.billing_subscriptions for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "billing_payments: owner or admin read" on public.billing_payments for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "razorpay_plans: admin read" on public.razorpay_plans for select to authenticated using ((select public.is_admin()));
create policy "razorpay_events: admin read" on public.razorpay_events for select to authenticated using ((select public.is_admin()));
create policy "billing_issues: admin read" on public.billing_issues for select to authenticated using ((select public.is_admin()));
grant select on public.billing_subscriptions, public.billing_payments, public.razorpay_plans, public.razorpay_events, public.billing_issues to authenticated;

-- ---------------------------------------------------------------------------
-- Apply one captured payment, once. Called only by the razorpay function (service role).
--   * the amount must equal what we quoted (price + 18% GST), otherwise nothing is switched on and an issue is raised
--   * the same payment id can never extend a plan twice
--   * the plan runs until the end of the period Razorpay says was paid for
-- ---------------------------------------------------------------------------
create or replace function public.billing_apply_charge(
  p_subscription uuid, p_payment_id text, p_invoice_id text, p_amount_paise bigint, p_period_end timestamptz, p_method text, p_paid_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.billing_subscriptions;
  pay public.billing_payments;
  v_expires timestamptz;
  pr public.profiles;
begin
  select * into s from public.billing_subscriptions where id = p_subscription for update;
  if not found then raise exception 'Unknown subscription'; end if;

  if p_amount_paise is distinct from round(s.total_inr * 100)::bigint then
    insert into public.billing_issues (kind, severity, user_id, subscription_id, rzp_payment_id, details)
    values ('amount_mismatch', 'high', s.user_id, s.id, p_payment_id, jsonb_build_object('paid_paise', p_amount_paise, 'expected_paise', round(s.total_inr * 100)))
    on conflict do nothing;
    insert into public.billing_payments (user_id, subscription_id, rzp_payment_id, rzp_invoice_id, status, amount_inr, method, error, paid_at)
    values (s.user_id, s.id, p_payment_id, p_invoice_id, 'authorized', p_amount_paise / 100.0, p_method, 'Amount does not match the plan price', p_paid_at)
    on conflict (rzp_payment_id) do nothing;
    return jsonb_build_object('applied', false, 'reason', 'amount_mismatch');
  end if;

  insert into public.billing_payments as bp (user_id, subscription_id, rzp_payment_id, rzp_invoice_id, status, amount_inr, base_inr, gst_inr, method, period_end, paid_at)
  values (s.user_id, s.id, p_payment_id, p_invoice_id, 'captured', s.total_inr, s.base_inr, s.gst_inr, p_method, p_period_end, coalesce(p_paid_at, now()))
  on conflict (rzp_payment_id) do update
    set status = 'captured', amount_inr = excluded.amount_inr, base_inr = excluded.base_inr, gst_inr = excluded.gst_inr,
        method = coalesce(excluded.method, bp.method), period_end = excluded.period_end, paid_at = excluded.paid_at, error = null,
        rzp_invoice_id = coalesce(excluded.rzp_invoice_id, bp.rzp_invoice_id)
    where bp.status in ('authorized', 'failed')
  returning * into pay;
  if pay.id is null then
    return jsonb_build_object('applied', false, 'reason', 'duplicate'); -- this payment was already counted
  end if;

  update public.billing_subscriptions set
    status = case when status in ('cancelled', 'completed', 'halted') and not cancel_at_cycle_end then status else 'active' end,
    paid_count = paid_count + 1,
    current_end = greatest(coalesce(current_end, p_period_end), p_period_end),
    updated_at = now()
  where id = s.id;

  select * into pr from public.profiles where id = s.user_id;
  v_expires := case when pr.plan = s.plan and pr.plan_expires_at is not null and pr.plan_expires_at > p_period_end then pr.plan_expires_at else p_period_end end;
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set plan = s.plan, plan_expires_at = v_expires where id = s.user_id;
  perform set_config('app.bypass_protect', 'off', true);

  insert into public.subscriptions (user_id, plan, period, amount_inr, provider, starts_at, ends_at)
  values (s.user_id, s.plan, s.period, round(s.base_inr)::integer, 'razorpay', coalesce(p_paid_at, now()), p_period_end);

  perform public.notify_email('billing_payment', pay.id::text);
  return jsonb_build_object('applied', true, 'payment_id', pay.id, 'plan_expires_at', v_expires);
end $$;
revoke execute on function public.billing_apply_charge(uuid, text, text, bigint, timestamptz, text, timestamptz) from public, anon, authenticated;

-- A failed payment attempt: recorded once, emailed once. A payment already captured is never turned into a failure by a late message.
create or replace function public.billing_record_failure(p_subscription uuid, p_payment_id text, p_amount_paise bigint, p_method text, p_error text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.billing_subscriptions;
  pay_id uuid;
begin
  select * into s from public.billing_subscriptions where id = p_subscription;
  if not found then return jsonb_build_object('recorded', false); end if;
  insert into public.billing_payments (user_id, subscription_id, rzp_payment_id, status, amount_inr, method, error)
  values (s.user_id, s.id, p_payment_id, 'failed', p_amount_paise / 100.0, p_method, left(p_error, 300))
  on conflict (rzp_payment_id) do nothing
  returning id into pay_id;
  if pay_id is not null then perform public.notify_email('billing_payment', pay_id::text); end if;
  return jsonb_build_object('recorded', pay_id is not null);
end $$;
revoke execute on function public.billing_record_failure(uuid, text, bigint, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Emails: a subscription that was cancelled, or stopped renewing
-- ---------------------------------------------------------------------------
create or replace function public.billing_subscriptions_email_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('cancelled', 'halted') then
    perform public.notify_email('billing_sub', new.id::text);
  end if;
  return null;
end $$;
create trigger billing_subscriptions_email_notify after update on public.billing_subscriptions for each row execute function public.billing_subscriptions_email_notify();

-- ---------------------------------------------------------------------------
-- Admin: resolve an issue (logged), and an overview for the Razorpay page
-- ---------------------------------------------------------------------------
create or replace function public.admin_resolve_billing_issue(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('resolved', 'dismissed', 'open') then raise exception 'Invalid status'; end if;
  update public.billing_issues set status = p_status, note = nullif(trim(p_note), ''), resolved_at = case when p_status = 'open' then null else now() end where id = p_id;
  perform public.admin_log('billing_issue_' || p_status, 'billing_issues', p_id::text, jsonb_build_object('note', left(trim(coalesce(p_note, '')), 300)));
end $$;
revoke execute on function public.admin_resolve_billing_issue(uuid, text, text) from public, anon;
grant execute on function public.admin_resolve_billing_issue(uuid, text, text) to authenticated;

create or replace function public.admin_billing_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'last_event', (select max(received_at) from public.razorpay_events),
    'events_24h', (select count(*) from public.razorpay_events where received_at > now() - interval '24 hours'),
    'failed_24h', (select count(*) from public.razorpay_events where status = 'failed' and received_at > now() - interval '24 hours'),
    'unprocessed', (select count(*) from public.razorpay_events where status = 'received' and received_at < now() - interval '10 minutes'),
    'open_issues', (select count(*) from public.billing_issues where status = 'open'),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) as n from public.billing_subscriptions group by 1) x),
    'active_auto_renew', (select count(*) from public.billing_subscriptions where status = 'active' and not cancel_at_cycle_end),
    'mrr', (select coalesce(round(sum(case period when 'year' then base_inr / 12 else base_inr end)), 0) from public.billing_subscriptions where status in ('active', 'authenticated') and not cancel_at_cycle_end),
    'collected_30d', (select coalesce(round(sum(amount_inr)), 0) from public.billing_payments where status = 'captured' and paid_at > now() - interval '30 days'),
    'gst_30d', (select coalesce(round(sum(gst_inr)), 0) from public.billing_payments where status = 'captured' and paid_at > now() - interval '30 days'),
    'failed_payments_7d', (select count(*) from public.billing_payments where status = 'failed' and created_at > now() - interval '7 days')
  );
end $$;
revoke execute on function public.admin_billing_overview() from public, anon;
grant execute on function public.admin_billing_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin numbers now include subscription revenue, GST and MRR; the status page shows webhook health
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
    'plan_revenue_30d', (select coalesce(sum(amount_inr), 0) from public.plan_payments where status = 'approved' and decided_at > now() - interval '30 days')
                      + (select coalesce(round(sum(base_inr)), 0) from public.billing_payments where status = 'captured' and paid_at > now() - interval '30 days'),
    'plan_revenue_total', (select coalesce(sum(amount_inr), 0) from public.plan_payments where status = 'approved')
                        + (select coalesce(round(sum(base_inr)), 0) from public.billing_payments where status = 'captured'),
    'gst_collected_30d', (select coalesce(round(sum(gst_inr)), 0) from public.billing_payments where status = 'captured' and paid_at > now() - interval '30 days'),
    'mrr', (select coalesce(round(sum(case period when 'year' then base_inr / 12 else base_inr end)), 0) from public.billing_subscriptions where status in ('active', 'authenticated') and not cancel_at_cycle_end),
    'revenue_daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'sales', s, 'plans', pl) order by d), '[]'::jsonb) from (
        select g::date as d,
          (select coalesce(sum(amount_inr), 0) from public.orders where status = 'paid' and created_at::date = g::date) as s,
          (select coalesce(sum(amount_inr), 0) from public.plan_payments where status = 'approved' and decided_at::date = g::date) + (select coalesce(round(sum(base_inr)), 0) from public.billing_payments where status = 'captured' and paid_at::date = g::date) as pl
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
    'razorpay', jsonb_build_object(
      'last_event', (select max(received_at) from public.razorpay_events),
      'failed_24h', (select count(*) from public.razorpay_events where status = 'failed' and received_at > now() - interval '24 hours'),
      'unprocessed', (select count(*) from public.razorpay_events where status = 'received' and received_at < now() - interval '10 minutes'),
      'open_issues', (select count(*) from public.billing_issues where status = 'open'),
      'stuck_subscriptions', (select count(*) from public.billing_subscriptions where status in ('created', 'authenticated') and created_at < now() - interval '30 minutes' and created_at > now() - interval '3 days')),
    'tickets_not_alerted', (select count(*) from public.support_tickets where created_at > now() - interval '7 days' and (notified ? 'none' or notified::text like '%failed%' or notified::text like '%skipped%'))
  );
end $$;

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
      'overrides', (select count(*) from public.subscriptions s where s.user_id = pr.id and s.provider = 'admin'),
      'rzp_status', (select b.status from public.billing_subscriptions b where b.user_id = pr.id order by b.created_at desc limit 1),
      'rzp_auto_renew', (select (b.status = 'active' and not b.cancel_at_cycle_end) from public.billing_subscriptions b where b.user_id = pr.id order by b.created_at desc limit 1),
      'rzp_failed', (select count(*) from public.billing_payments bp where bp.user_id = pr.id and bp.status = 'failed')
    ) order by pr.plan_expires_at nulls last)
    from public.profiles pr
    where pr.role = 'creator' and (pr.plan <> 'free' or exists (select 1 from public.plan_payments pp where pp.user_id = pr.id) or exists (select 1 from public.billing_subscriptions b where b.user_id = pr.id))
  ), '[]'::jsonb);
end $$;

-- Every 10 minutes: ask Razorpay about subscriptions that are stuck or look out of date (safety net for missed webhooks)
select cron.unschedule(jobid) from cron.job where jobname = 'razorpay-reconcile';
select cron.schedule('razorpay-reconcile', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/razorpay',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secret),
    body := jsonb_build_object('action', 'reconcile'),
    timeout_milliseconds := 60000
  )
  from (select (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret) s
  where coalesce(s.secret, '') <> ''
$job$);
select cron.schedule('purge-razorpay-events', '47 3 * * *', $$delete from public.razorpay_events where received_at < now() - interval '180 days' and status in ('processed', 'ignored')$$);
