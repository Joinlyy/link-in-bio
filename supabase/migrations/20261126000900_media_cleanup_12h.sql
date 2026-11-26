-- Uploaded files for scheduled posts are temporary. Once a post is published (or cancelled, failed, or never scheduled) its file is
-- removed within about 12 hours; only the post's link, time and status stay in the table. Files of posts still waiting to go out are kept.
create or replace function public.ig_orphan_media()
returns table (name text) language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'ig-posts' and o.created_at < now() - interval '12 hours'
    and not exists (select 1 from public.ig_scheduled_posts p where p.media_path = o.name and p.status in ('scheduled', 'publishing'))
  limit 500;
$$;
revoke execute on function public.ig_orphan_media() from public, anon, authenticated;

-- Every hour instead of once a day
select cron.unschedule(jobid) from cron.job where jobname = 'instagram-purge-media';
select cron.schedule('instagram-purge-media', '20 * * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secret),
    body := jsonb_build_object('action', 'purge_media'),
    timeout_milliseconds := 60000
  )
  from (select (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret) s
  where coalesce(s.secret, '') <> ''
$job$);
