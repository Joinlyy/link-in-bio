-- Scheduled analytics rollups and retention (requires the pg_cron extension).
-- Enable it in Dashboard → Database → Extensions if this migration fails.
create extension if not exists pg_cron with schema pg_catalog;

-- Today's numbers every 10 minutes, yesterday's finalised hourly
select cron.schedule('rollup-today', '*/10 * * * *',
  $$select public.rollup_events((now() at time zone 'Asia/Kolkata')::date)$$);
select cron.schedule('rollup-yesterday', '5 * * * *',
  $$select public.rollup_events((now() at time zone 'Asia/Kolkata')::date - 1)$$);

-- Raw events are only needed until they are rolled up; keep 120 days for re-processing
select cron.schedule('purge-old-events', '30 21 * * *',
  $$delete from public.events where created_at < now() - interval '120 days'$$);

-- Expired Instagram OAuth states
select cron.schedule('purge-oauth-states', '0 * * * *',
  $$delete from public.instagram_oauth_states where created_at < now() - interval '1 hour'$$);
