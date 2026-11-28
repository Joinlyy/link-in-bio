-- Cross-platform publishing: LinkedIn and YouTube (Instagram keeps its own tables and flow).
-- One row per platform per post. A cross-post shares a group_id and the same uploaded files.

-- ---------------------------------------------------------------------------
-- Connected accounts. What the creator may see is separate from the tokens, which nobody but the server can read.
-- ---------------------------------------------------------------------------
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('linkedin', 'youtube')),
  external_id text not null,
  display_name text,
  avatar_url text,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  unique (owner_id, platform)
);
alter table public.social_accounts enable row level security;
revoke all on public.social_accounts from anon, authenticated;
grant select on public.social_accounts to authenticated;
drop policy if exists "social_accounts: own read" on public.social_accounts;
create policy "social_accounts: own read" on public.social_accounts for select to authenticated using (owner_id = (select auth.uid()));

create table if not exists public.social_tokens (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('linkedin', 'youtube')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  updated_at timestamptz not null default now(),
  primary key (owner_id, platform)
);
alter table public.social_tokens enable row level security;
revoke all on public.social_tokens from anon, authenticated;

create table if not exists public.social_oauth_states (
  state text primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null,
  redirect_uri text not null,
  created_at timestamptz not null default now()
);
alter table public.social_oauth_states enable row level security;
revoke all on public.social_oauth_states from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('linkedin', 'youtube')),
  kind text not null check (kind in ('TEXT', 'IMAGE', 'CAROUSEL', 'VIDEO')),
  caption text not null default '' check (char_length(caption) <= 5000),
  title text check (title is null or char_length(title) <= 100),
  media_path text,
  media_url text,
  items jsonb not null default '[]'::jsonb,
  options jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  attempts integer not null default 0,
  claimed_at timestamptz,
  external_id text,
  permalink text,
  error text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists social_posts_due_idx on public.social_posts (scheduled_at) where status in ('scheduled', 'publishing');
create index if not exists social_posts_owner_idx on public.social_posts (owner_id, scheduled_at desc);
alter table public.social_posts enable row level security;
revoke all on public.social_posts from anon, authenticated;
grant select (id, group_id, platform, kind, caption, title, media_path, media_url, items, options, scheduled_at, status, attempts, external_id, permalink, error, published_at, created_at)
  on public.social_posts to authenticated;
drop policy if exists "social_posts: own read" on public.social_posts;
create policy "social_posts: own read" on public.social_posts for select to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Schedule, cancel, retry
-- ---------------------------------------------------------------------------
create or replace function public.schedule_social_post(
  p_platform text, p_kind text, p_caption text, p_title text, p_path text, p_url text, p_items jsonb, p_at timestamptz, p_group uuid default null, p_options jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_day_max integer := coalesce((public.plan_features(auth.uid()) ->> 'ig_posts_per_day')::integer, 1);
  v_day date := (greatest(p_at, now()) at time zone 'Asia/Kolkata')::date;
  v_n integer;
  v_text_max integer := case when p_platform = 'youtube' then 5000 else 3000 end;
  it jsonb;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_platform not in ('linkedin', 'youtube') then raise exception 'Unknown platform' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.social_accounts where owner_id = v_uid and platform = p_platform) then
    raise exception 'Connect your % account first (Settings, Connected accounts)', initcap(p_platform) using errcode = 'P0001';
  end if;
  if p_kind not in ('TEXT', 'IMAGE', 'CAROUSEL', 'VIDEO') then raise exception 'Choose what to post' using errcode = 'P0001'; end if;
  if p_platform = 'youtube' and p_kind <> 'VIDEO' then raise exception 'YouTube posts are videos' using errcode = 'P0001'; end if;
  if p_kind = 'TEXT' and char_length(btrim(coalesce(p_caption, ''))) = 0 then raise exception 'Write something to post' using errcode = 'P0001'; end if;
  if p_kind in ('IMAGE', 'VIDEO') and (p_path not like v_uid::text || '/%' or p_url not like '%/storage/v1/object/public/ig-posts/' || v_uid::text || '/%') then
    raise exception 'Upload the file again' using errcode = 'P0001';
  end if;
  if p_kind = 'CAROUSEL' then
    if jsonb_typeof(p_items) <> 'array' then raise exception 'Choose your photos again' using errcode = 'P0001'; end if;
    v_n := jsonb_array_length(p_items);
    if v_n < 2 or v_n > 9 then raise exception 'A multi-photo post needs 2 to 9 photos' using errcode = 'P0001'; end if;
    for it in select * from jsonb_array_elements(p_items) loop
      if coalesce(it ->> 'path', '') not like v_uid::text || '/%' or coalesce(it ->> 'url', '') not like '%/storage/v1/object/public/ig-posts/' || v_uid::text || '/%' then
        raise exception 'Upload the photos again' using errcode = 'P0001';
      end if;
    end loop;
  end if;
  if char_length(coalesce(p_caption, '')) > v_text_max then raise exception 'The text is too long' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_title, '')) > 100 then raise exception 'The title is too long (100 characters at most)' using errcode = 'P0001'; end if;
  if p_at is null or p_at > now() + interval '75 days' then raise exception 'Pick a time within the next 75 days' using errcode = 'P0001'; end if;
  if (select count(*) from public.social_posts where owner_id = v_uid and status in ('scheduled', 'publishing')) >= 30 then
    raise exception 'You already have 30 posts waiting. Let some go out first.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.social_posts where owner_id = v_uid and platform = p_platform and status in ('scheduled', 'publishing', 'published')
        and (scheduled_at at time zone 'Asia/Kolkata')::date = v_day) >= v_day_max then
    raise exception 'Your plan allows % %-post% a day. Pick another day, or upgrade for more.', v_day_max, initcap(p_platform), case when v_day_max = 1 then '' else 's' end using errcode = 'P0001';
  end if;
  insert into public.social_posts (group_id, owner_id, platform, kind, caption, title, media_path, media_url, items, options, scheduled_at)
  values (coalesce(p_group, gen_random_uuid()), v_uid, p_platform, p_kind, coalesce(p_caption, ''), nullif(btrim(coalesce(p_title, '')), ''),
    case when p_kind = 'CAROUSEL' then p_items -> 0 ->> 'path' else p_path end,
    case when p_kind = 'CAROUSEL' then p_items -> 0 ->> 'url' else p_url end,
    case when p_kind = 'CAROUSEL' then (select jsonb_agg(jsonb_build_object('path', e ->> 'path', 'url', e ->> 'url')) from jsonb_array_elements(p_items) e) else '[]'::jsonb end,
    coalesce(p_options, '{}'::jsonb), greatest(p_at, now()))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.schedule_social_post(text, text, text, text, text, text, jsonb, timestamptz, uuid, jsonb) from public, anon;
grant execute on function public.schedule_social_post(text, text, text, text, text, text, jsonb, timestamptz, uuid, jsonb) to authenticated;

create or replace function public.cancel_social_post(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.social_posts set status = 'cancelled' where id = p_id and owner_id = auth.uid() and status in ('scheduled', 'failed');
end $$;
revoke execute on function public.cancel_social_post(uuid) from public, anon;
grant execute on function public.cancel_social_post(uuid) to authenticated;

create or replace function public.retry_social_post(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.social_posts set status = 'scheduled', error = null, attempts = 0, claimed_at = null, scheduled_at = greatest(scheduled_at, now())
   where id = p_id and owner_id = auth.uid() and status = 'failed';
end $$;
revoke execute on function public.retry_social_post(uuid) from public, anon;
grant execute on function public.retry_social_post(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Files are shared between Instagram and the other platforms: keep one until every post that uses it is done
-- ---------------------------------------------------------------------------
create or replace function public.social_media_in_use(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.social_posts p
    where p.status in ('scheduled', 'publishing') and (p.media_path = p_path or exists (select 1 from jsonb_array_elements(p.items) i where i ->> 'path' = p_path))
  ) or exists (
    select 1 from public.ig_scheduled_posts p
    where p.status in ('scheduled', 'publishing') and (p.media_path = p_path or exists (select 1 from jsonb_array_elements(p.items) i where i ->> 'path' = p_path))
  );
$$;
revoke execute on function public.social_media_in_use(text) from public, anon, authenticated;

create or replace function public.ig_orphan_media()
returns table (name text) language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'ig-posts' and o.created_at < now() - interval '12 hours'
    and not public.social_media_in_use(o.name)
  limit 500;
$$;
revoke execute on function public.ig_orphan_media() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Every minute: publish what is due
-- ---------------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'social-publish-due';
select cron.schedule('social-publish-due', '* * * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/social',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secret),
    body := jsonb_build_object('action', 'publish_due'),
    timeout_milliseconds := 150000
  )
  from (select (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret) s
  where coalesce(s.secret, '') <> ''
    and exists (select 1 from public.social_posts where status in ('scheduled', 'publishing') and scheduled_at <= now())
$job$);
