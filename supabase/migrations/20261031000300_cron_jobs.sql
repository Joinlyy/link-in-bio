-- =====================================================================
-- Scheduled edge-function calls (pg_cron + pg_net)
--   instagram-sync-all : daily 02:30 IST (21:00 UTC) → instagram {action:'sync_all'}
--   dm-follow-ups      : every 5 minutes             → instagram-webhook (due follow-ups)
--
-- Both send header `x-cron-secret`, read at run time from Supabase Vault:
--   select vault.create_secret('<same value as the CRON_SECRET function secret>', 'cron_secret');
-- The secret is NOT created here. Until it exists the jobs run but send nothing.
-- =====================================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Re-runnable: drop earlier versions of these jobs
select cron.unschedule(jobid) from cron.job where jobname in ('instagram-sync-all', 'dm-follow-ups');

select cron.schedule('instagram-sync-all', '30 21 * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secret),
    body := jsonb_build_object('action', 'sync_all'),
    timeout_milliseconds := 120000
  )
  from (select (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret) s
  where coalesce(s.secret, '') <> '';
$job$);

select cron.schedule('dm-follow-ups', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/instagram-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  from (select (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret) s
  where coalesce(s.secret, '') <> '';
$job$);
