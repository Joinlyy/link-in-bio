-- Scheduler limits for all platforms (Instagram, LinkedIn, YouTube, Facebook)
--   Starter (free): 10-day free trial of scheduling, from the first scheduled post, with the Creator limits. After that, upgrade.
--   Creator:        60 scheduled posts a month, of which at most 45 can be videos
--   Pro:            90 scheduled posts a month, of which at most 60 can be videos
--   Every plan:     at most 300 MB of photos and videos waiting to go out at one time
--   DMs:            Starter 30 a month, Creator and Pro unlimited
-- Each post to one platform counts once. A month is counted in India time, on the month the post goes out.
-- Cancelled and failed posts do not count.
update public.plans set features = features || '{"schedule_trial_days": 10, "schedule_posts_per_month": 60, "schedule_videos_per_month": 45, "ig_posts_per_day": 3, "ig_reels_per_month": 45, "dm_monthly_limit": 30}'::jsonb where id = 'free';
update public.plans set features = features || '{"schedule_posts_per_month": 60, "schedule_videos_per_month": 45, "ig_reels_per_month": 45}'::jsonb where id = 'pro';
update public.plans set features = features || '{"schedule_posts_per_month": 90, "schedule_videos_per_month": 60, "ig_reels_per_month": 60}'::jsonb where id = 'business';

-- Bytes of photos and videos that scheduled posts are holding right now (each file counted once)
create or replace function public.pending_media_bytes(p_uid uuid, p_extra text[] default '{}')
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint from storage.objects o
  where o.bucket_id = 'ig-posts' and o.name in (
    select p.media_path from public.ig_scheduled_posts p where p.owner_id = p_uid and p.status in ('scheduled', 'publishing') and coalesce(p.media_path, '') <> ''
    union select i ->> 'path' from public.ig_scheduled_posts p, jsonb_array_elements(p.items) i where p.owner_id = p_uid and p.status in ('scheduled', 'publishing')
    union select s.media_path from public.social_posts s where s.owner_id = p_uid and s.status in ('scheduled', 'publishing') and coalesce(s.media_path, '') <> ''
    union select i ->> 'path' from public.social_posts s, jsonb_array_elements(s.items) i where s.owner_id = p_uid and s.status in ('scheduled', 'publishing')
    union select unnest(p_extra)
  );
$$;
revoke execute on function public.pending_media_bytes(uuid, text[]) from public, anon, authenticated;

-- All the plan checks for one more scheduled post
create or replace function public.scheduler_check(p_uid uuid, p_is_video boolean, p_at timestamptz, p_paths text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  f jsonb := public.plan_features(p_uid);
  v_trial integer := nullif(f ->> 'schedule_trial_days', '')::integer;
  v_posts_max integer := nullif(f ->> 'schedule_posts_per_month', '')::integer;
  v_videos_max integer := nullif(f ->> 'schedule_videos_per_month', '')::integer;
  v_first timestamptz;
  v_month date := date_trunc('month', p_at at time zone 'Asia/Kolkata')::date;
  v_posts integer;
  v_videos integer;
  v_cap constant bigint := 300 * 1024 * 1024;
  v_bytes bigint;
begin
  -- Free trial: it starts with the first scheduled post and covers the next N days
  if v_trial is not null then
    select min(t) into v_first from (
      select min(created_at) as t from public.ig_scheduled_posts where owner_id = p_uid
      union all select min(created_at) from public.social_posts where owner_id = p_uid) x;
    if v_first is not null and v_first + make_interval(days => v_trial) < now() then
      raise exception 'Your % day free trial of scheduling has ended. Upgrade to Creator to keep scheduling posts.', v_trial using errcode = 'P0001';
    end if;
    if p_at > coalesce(v_first, now()) + make_interval(days => v_trial) then
      raise exception 'During the % day free trial, pick a time within the trial. Upgrade to Creator to schedule further ahead.', v_trial using errcode = 'P0001';
    end if;
  end if;

  select (select count(*) from public.ig_scheduled_posts where owner_id = p_uid and status in ('scheduled', 'publishing', 'published')
            and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata')::date = v_month)
       + (select count(*) from public.social_posts where owner_id = p_uid and status in ('scheduled', 'publishing', 'published')
            and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata')::date = v_month),
         (select count(*) from public.ig_scheduled_posts where owner_id = p_uid and media_type = 'REELS' and status in ('scheduled', 'publishing', 'published')
            and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata')::date = v_month)
       + (select count(*) from public.social_posts where owner_id = p_uid and kind = 'VIDEO' and status in ('scheduled', 'publishing', 'published')
            and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata')::date = v_month)
    into v_posts, v_videos;
  if v_posts_max is not null and v_posts >= v_posts_max then
    raise exception 'Your plan allows % scheduled posts a month. Pick a day next month, or upgrade for more.', v_posts_max using errcode = 'P0001';
  end if;
  if p_is_video and v_videos_max is not null and v_videos >= v_videos_max then
    raise exception 'Your plan allows % videos a month. Pick a day next month, or upgrade for more.', v_videos_max using errcode = 'P0001';
  end if;

  v_bytes := public.pending_media_bytes(p_uid, coalesce(p_paths, '{}'));
  if v_bytes > v_cap then
    raise exception 'Your waiting posts would hold % MB of photos and videos (the limit is 300 MB). Let some go out, or remove one, then try again.', round(v_bytes / 1048576.0) using errcode = 'P0001';
  end if;
end $$;
revoke execute on function public.scheduler_check(uuid, boolean, timestamptz, text[]) from public, anon, authenticated;

-- Run the checks from every scheduling function
do $$
declare
  d text;
begin
  select pg_get_functiondef('public.schedule_ig_post(text, text, text, text, timestamptz)'::regprocedure) into d;
  if d not like '%perform public.ig_check_limits(v_uid, p_type, greatest(p_at, now()));%' then raise exception 'schedule_ig_post has no limit call'; end if;
  d := replace(d, 'perform public.ig_check_limits(v_uid, p_type, greatest(p_at, now()));',
    'perform public.ig_check_limits(v_uid, p_type, greatest(p_at, now()));' || chr(10) || '  perform public.scheduler_check(v_uid, p_type = ''REELS'', greatest(p_at, now()), array[p_path]);');
  execute d;

  select pg_get_functiondef('public.schedule_ig_carousel(jsonb, text, timestamptz)'::regprocedure) into d;
  if d not like '%perform public.ig_check_limits(v_uid, ''CAROUSEL'', greatest(p_at, now()));%' then raise exception 'schedule_ig_carousel has no limit call'; end if;
  d := replace(d, 'perform public.ig_check_limits(v_uid, ''CAROUSEL'', greatest(p_at, now()));',
    'perform public.ig_check_limits(v_uid, ''CAROUSEL'', greatest(p_at, now()));' || chr(10) || '  perform public.scheduler_check(v_uid, false, greatest(p_at, now()), (select array_agg(e ->> ''path'') from jsonb_array_elements(p_items) e));');
  execute d;

  select pg_get_functiondef('public.schedule_social_post(text, text, text, text, text, text, jsonb, timestamptz, uuid, jsonb, uuid)'::regprocedure) into d;
  if d not like '%  insert into public.social_posts (group_id,%' then raise exception 'schedule_social_post insert not found'; end if;
  d := replace(d, '  insert into public.social_posts (group_id,',
    '  perform public.scheduler_check(v_uid, p_kind = ''VIDEO'', greatest(p_at, now()), array_remove(array[p_path], null) || case when jsonb_typeof(p_items) = ''array'' then coalesce((select array_agg(e ->> ''path'') from jsonb_array_elements(p_items) e), ''{}''::text[]) else ''{}''::text[] end);' || chr(10) || '  insert into public.social_posts (group_id,');
  execute d;
end $$;

-- What the creator sees
create or replace function public.my_post_allowance()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'posts_per_day', coalesce((f ->> 'ig_posts_per_day')::integer, 1),
    'reels_per_month', coalesce((f ->> 'ig_reels_per_month')::integer, 15),
    'posts_today', (select count(*) from public.ig_scheduled_posts where owner_id = auth.uid() and status in ('scheduled', 'publishing', 'published')
                    and (scheduled_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
    'reels_this_month', (select count(*) from public.ig_scheduled_posts where owner_id = auth.uid() and media_type = 'REELS' and status in ('scheduled', 'publishing', 'published')
                    and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata')),
    'posts_per_month', nullif(f ->> 'schedule_posts_per_month', '')::integer,
    'videos_per_month', nullif(f ->> 'schedule_videos_per_month', '')::integer,
    'posts_this_month',
      (select count(*) from public.ig_scheduled_posts where owner_id = auth.uid() and status in ('scheduled', 'publishing', 'published') and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata'))
      + (select count(*) from public.social_posts where owner_id = auth.uid() and status in ('scheduled', 'publishing', 'published') and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata')),
    'videos_this_month',
      (select count(*) from public.ig_scheduled_posts where owner_id = auth.uid() and media_type = 'REELS' and status in ('scheduled', 'publishing', 'published') and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata'))
      + (select count(*) from public.social_posts where owner_id = auth.uid() and kind = 'VIDEO' and status in ('scheduled', 'publishing', 'published') and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata')),
    'trial_days', nullif(f ->> 'schedule_trial_days', '')::integer,
    'trial_ends_at', case when nullif(f ->> 'schedule_trial_days', '') is null then null else
      (select min(t) from (select min(created_at) as t from public.ig_scheduled_posts where owner_id = auth.uid() union all select min(created_at) from public.social_posts where owner_id = auth.uid()) y)
        + make_interval(days => (f ->> 'schedule_trial_days')::integer) end,
    'waiting_mb', round(public.pending_media_bytes(auth.uid()) / 1048576.0),
    'cap_mb', 300)
  from (select public.plan_features(auth.uid()) as f) x;
$$;
revoke execute on function public.my_post_allowance() from public, anon;
grant execute on function public.my_post_allowance() to authenticated;
