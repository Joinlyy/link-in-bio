-- A post being published is leased for a few minutes, so the cron run and a "Post now" press never work on the same post at once.
alter table public.ig_scheduled_posts add column if not exists claimed_at timestamptz;
