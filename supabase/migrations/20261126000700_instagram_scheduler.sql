-- Instagram post scheduling: a creator uploads a photo or a Reel, writes a caption and picks a time (or publishes now).
-- A job every minute publishes what is due through the Instagram API (instagram_business_content_publish).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ig-posts', 'ig-posts', true, 52428800, array['image/jpeg', 'video/mp4', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = array['image/jpeg', 'video/mp4', 'video/quicktime'];

-- Anyone can read (Instagram has to fetch the file); only the owner writes inside their own folder
drop policy if exists "ig-posts: public read" on storage.objects;
create policy "ig-posts: public read" on storage.objects for select using (bucket_id = 'ig-posts');
drop policy if exists "ig-posts: owner upload" on storage.objects;
create policy "ig-posts: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'ig-posts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "ig-posts: owner delete" on storage.objects;
create policy "ig-posts: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'ig-posts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists public.ig_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  media_type text not null check (media_type in ('IMAGE', 'REELS')),
  media_path text not null,
  media_url text not null,
  caption text not null default '' check (char_length(caption) <= 2200),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  creation_id text,
  ig_media_id text,
  permalink text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists ig_scheduled_posts_due_idx on public.ig_scheduled_posts (scheduled_at) where status in ('scheduled', 'publishing');
create index if not exists ig_scheduled_posts_owner_idx on public.ig_scheduled_posts (owner_id, scheduled_at desc);
alter table public.ig_scheduled_posts enable row level security;
drop policy if exists "ig_scheduled_posts: own read" on public.ig_scheduled_posts;
create policy "ig_scheduled_posts: own read" on public.ig_scheduled_posts for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.ig_scheduled_posts from anon, authenticated;
grant select (id, owner_id, media_type, media_url, caption, scheduled_at, status, ig_media_id, permalink, error, attempts, created_at, published_at)
  on public.ig_scheduled_posts to authenticated;

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
  insert into public.ig_scheduled_posts (owner_id, media_type, media_path, media_url, caption, scheduled_at)
  values (v_uid, p_type, p_path, p_url, coalesce(p_caption, ''), greatest(p_at, now()))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.schedule_ig_post(text, text, text, text, timestamptz) to authenticated;

create or replace function public.cancel_ig_post(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.ig_scheduled_posts set status = 'cancelled' where id = p_id and owner_id = auth.uid() and status in ('scheduled', 'failed');
  if not found then raise exception 'This post can not be cancelled any more' using errcode = 'P0001'; end if;
end $$;
grant execute on function public.cancel_ig_post(uuid) to authenticated;

create or replace function public.retry_ig_post(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.ig_scheduled_posts set status = 'scheduled', error = null, creation_id = null, scheduled_at = greatest(scheduled_at, now())
   where id = p_id and owner_id = auth.uid() and status = 'failed';
  if not found then raise exception 'Only a failed post can be tried again' using errcode = 'P0001'; end if;
end $$;
grant execute on function public.retry_ig_post(uuid) to authenticated;

-- Every minute: publish what is due
select cron.unschedule(jobid) from cron.job where jobname = 'instagram-publish-due';
select cron.schedule('instagram-publish-due', '* * * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secret),
    body := jsonb_build_object('action', 'publish_due'),
    timeout_milliseconds := 120000
  )
  from (select (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret) s
  where coalesce(s.secret, '') <> ''
    and exists (select 1 from public.ig_scheduled_posts where status in ('scheduled', 'publishing') and scheduled_at <= now())
$job$);
