-- Post scheduler limits by plan.
--   Starter (free):  1 post a day,  15 Reels a month
--   Creator (pro):   3 posts a day, 40 Reels a month
--   Pro (business):  3 posts a day, 50 Reels a month
-- A day and a month are counted in India time, on the day the post goes out. Cancelled and failed posts do not count.
update public.plans set features = features || '{"ig_posts_per_day": 1, "ig_reels_per_month": 15}'::jsonb where id = 'free';
update public.plans set features = features || '{"ig_posts_per_day": 3, "ig_reels_per_month": 40}'::jsonb where id = 'pro';
update public.plans set features = features || '{"ig_posts_per_day": 3, "ig_reels_per_month": 50}'::jsonb where id = 'business';

create or replace function public.ig_check_limits(p_uid uuid, p_type text, p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  f jsonb := public.plan_features(p_uid);
  v_day_max integer := coalesce((f ->> 'ig_posts_per_day')::integer, 1);
  v_reel_max integer := coalesce((f ->> 'ig_reels_per_month')::integer, 15);
  v_day date := (p_at at time zone 'Asia/Kolkata')::date;
  v_today integer;
  v_reels integer;
begin
  select count(*) into v_today from public.ig_scheduled_posts
   where owner_id = p_uid and status in ('scheduled', 'publishing', 'published') and (scheduled_at at time zone 'Asia/Kolkata')::date = v_day;
  if v_today >= v_day_max then
    raise exception 'Your plan allows % post% a day. Pick another day, or upgrade for more.', v_day_max, case when v_day_max = 1 then '' else 's' end using errcode = 'P0001';
  end if;
  if p_type = 'REELS' then
    select count(*) into v_reels from public.ig_scheduled_posts
     where owner_id = p_uid and media_type = 'REELS' and status in ('scheduled', 'publishing', 'published')
       and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata') = date_trunc('month', p_at at time zone 'Asia/Kolkata');
    if v_reels >= v_reel_max then
      raise exception 'Your plan allows % Reels a month. Pick a day next month, or upgrade for more.', v_reel_max using errcode = 'P0001';
    end if;
  end if;
end $$;
revoke execute on function public.ig_check_limits(uuid, text, timestamptz) from public, anon, authenticated;

-- schedule_ig_post and schedule_ig_carousel now check the limits first
create or replace function public.schedule_ig_post(p_type text, p_path text, p_url text, p_caption text, p_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.instagram_accounts where owner_id = v_uid) then
    raise exception 'Connect your Instagram account first (Settings, Instagram)' using errcode = 'P0001';
  end if;
  if p_type not in ('IMAGE', 'REELS') then raise exception 'Choose a photo or a video' using errcode = 'P0001'; end if;
  if p_path not like v_uid::text || '/%' or p_url not like '%/storage/v1/object/public/ig-posts/' || v_uid::text || '/%' then
    raise exception 'Upload the file again' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_caption, '')) > 2200 then raise exception 'The caption is too long (2,200 characters at most)' using errcode = 'P0001'; end if;
  if p_at is null or p_at > now() + interval '75 days' then raise exception 'Pick a time within the next 75 days' using errcode = 'P0001'; end if;
  if (select count(*) from public.ig_scheduled_posts where owner_id = v_uid and status in ('scheduled', 'publishing')) >= 30 then
    raise exception 'You already have 30 posts waiting. Let some go out first.' using errcode = 'P0001';
  end if;
  perform public.ig_check_limits(v_uid, p_type, greatest(p_at, now()));
  insert into public.ig_scheduled_posts (owner_id, media_type, media_path, media_url, caption, scheduled_at)
  values (v_uid, p_type, p_path, p_url, coalesce(p_caption, ''), greatest(p_at, now()))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.schedule_ig_post(text, text, text, text, timestamptz) from public, anon;
grant execute on function public.schedule_ig_post(text, text, text, text, timestamptz) to authenticated;

create or replace function public.schedule_ig_carousel(p_items jsonb, p_caption text, p_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_n integer;
  it jsonb;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.instagram_accounts where owner_id = v_uid) then
    raise exception 'Connect your Instagram account first (Settings, Instagram)' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Choose your photos again' using errcode = 'P0001'; end if;
  v_n := jsonb_array_length(p_items);
  if v_n < 2 or v_n > 10 then raise exception 'A multi-photo post needs 2 to 10 photos' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if coalesce(it ->> 'path', '') not like v_uid::text || '/%' or coalesce(it ->> 'url', '') not like '%/storage/v1/object/public/ig-posts/' || v_uid::text || '/%' then
      raise exception 'Upload the photos again' using errcode = 'P0001';
    end if;
  end loop;
  if char_length(coalesce(p_caption, '')) > 2200 then raise exception 'The caption is too long (2,200 characters at most)' using errcode = 'P0001'; end if;
  if p_at is null or p_at > now() + interval '75 days' then raise exception 'Pick a time within the next 75 days' using errcode = 'P0001'; end if;
  if (select count(*) from public.ig_scheduled_posts where owner_id = v_uid and status in ('scheduled', 'publishing')) >= 30 then
    raise exception 'You already have 30 posts waiting. Let some go out first.' using errcode = 'P0001';
  end if;
  perform public.ig_check_limits(v_uid, 'CAROUSEL', greatest(p_at, now()));
  insert into public.ig_scheduled_posts (owner_id, media_type, media_path, media_url, items, caption, scheduled_at)
  values (v_uid, 'CAROUSEL', p_items -> 0 ->> 'path', p_items -> 0 ->> 'url',
    (select jsonb_agg(jsonb_build_object('path', e ->> 'path', 'url', e ->> 'url')) from jsonb_array_elements(p_items) e),
    coalesce(p_caption, ''), greatest(p_at, now()))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.schedule_ig_carousel(jsonb, text, timestamptz) from public, anon;
grant execute on function public.schedule_ig_carousel(jsonb, text, timestamptz) to authenticated;

-- What the creator sees: how much of today's and this month's allowance is used
create or replace function public.my_post_allowance()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'posts_per_day', coalesce((f ->> 'ig_posts_per_day')::integer, 1),
    'reels_per_month', coalesce((f ->> 'ig_reels_per_month')::integer, 15),
    'posts_today', (select count(*) from public.ig_scheduled_posts where owner_id = auth.uid() and status in ('scheduled', 'publishing', 'published')
                    and (scheduled_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date),
    'reels_this_month', (select count(*) from public.ig_scheduled_posts where owner_id = auth.uid() and media_type = 'REELS' and status in ('scheduled', 'publishing', 'published')
                    and date_trunc('month', scheduled_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata')))
  from (select public.plan_features(auth.uid()) as f) x;
$$;
revoke execute on function public.my_post_allowance() from public, anon;
grant execute on function public.my_post_allowance() to authenticated;
