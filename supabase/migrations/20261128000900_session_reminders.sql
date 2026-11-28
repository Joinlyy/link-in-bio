-- Reminder emails 24 hours and 1 hour before a 1:1 session or webinar, to the buyer and to the creator.
-- Runs every 10 minutes, and only when something is coming up. The email function sends each reminder once.
select cron.unschedule(jobid) from cron.job where jobname = 'email-session-reminders';
select cron.schedule('email-session-reminders', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secret),
    body := jsonb_build_object('action', 'session_reminders'),
    timeout_milliseconds := 60000
  )
  from (select (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret) s
  where coalesce(s.secret, '') <> ''
    and (exists (select 1 from public.bookings where status = 'confirmed' and starts_at > now() and starts_at < now() + interval '25 hours')
      or exists (select 1 from public.products where type = 'webinar'))
$job$);
