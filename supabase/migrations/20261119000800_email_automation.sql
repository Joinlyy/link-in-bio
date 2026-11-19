-- Automatic emails (sent by the `email` function through Brevo).
-- Database triggers tell the function when something happens; the function reads the row again and records each
-- email once in email_log, so a repeated or forged call sends nothing extra.

create table public.email_log (
  id bigint generated always as identity primary key,
  key text not null unique,
  event text not null,
  to_email text not null,
  status text,
  error text,
  created_at timestamptz not null default now()
);
create index email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
create policy "email_log: admin read" on public.email_log for select to authenticated using ((select public.is_admin()));
grant select on public.email_log to authenticated;

-- Async call to the email function (never blocks or breaks the write that caused it)
create or replace function public.notify_email(p_kind text, p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/email',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('action', 'event', 'kind', p_kind, 'id', p_id),
    timeout_milliseconds := 20000
  );
exception when others then
  null;
end $$;
revoke execute on function public.notify_email(text, text) from public, anon, authenticated;

-- New creator: welcome email
create or replace function public.profiles_email_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'creator' and new.email is not null then
    perform public.notify_email('welcome', new.id::text);
  end if;
  return null;
end $$;
drop trigger if exists profiles_email_notify on public.profiles;
create trigger profiles_email_notify after insert on public.profiles for each row execute function public.profiles_email_notify();

-- Orders: paid (buyer receipt, creator alert) and UPI payment rejected (buyer)
create or replace function public.orders_email_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.status in ('paid', 'failed'))
     or (tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('paid', 'failed')) then
    perform public.notify_email('order', new.id::text);
  end if;
  return null;
end $$;
drop trigger if exists orders_email_notify on public.orders;
create trigger orders_email_notify after insert or update on public.orders for each row execute function public.orders_email_notify();

-- Plan payments: approved or rejected (creator)
create or replace function public.plan_payments_email_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('approved', 'rejected') and new.status is distinct from old.status then
    perform public.notify_email('plan_payment', new.id::text);
  end if;
  return null;
end $$;
drop trigger if exists plan_payments_email_notify on public.plan_payments;
create trigger plan_payments_email_notify after update on public.plan_payments for each row execute function public.plan_payments_email_notify();

-- Daily at 09:00 IST (03:30 UTC): plans ending soon and plans that ended
select cron.unschedule(jobid) from cron.job where jobname = 'email-reminders';
select cron.schedule('email-reminders', '30 3 * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/email',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('action', 'reminders'),
    timeout_milliseconds := 60000
  )
$job$);
select cron.schedule('purge-email-log', '41 3 * * *', $$delete from public.email_log where created_at < now() - interval '180 days'$$);
