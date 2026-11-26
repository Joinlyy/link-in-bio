-- Multi-photo (carousel) posts: 2 to 10 photos, one caption, one time.
alter table public.ig_scheduled_posts drop constraint if exists ig_scheduled_posts_media_type_check;
alter table public.ig_scheduled_posts add constraint ig_scheduled_posts_media_type_check check (media_type in ('IMAGE', 'REELS', 'CAROUSEL'));
alter table public.ig_scheduled_posts add column if not exists items jsonb not null default '[]'::jsonb;
grant select (items) on public.ig_scheduled_posts to authenticated;

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
  insert into public.ig_scheduled_posts (owner_id, media_type, media_path, media_url, items, caption, scheduled_at)
  values (v_uid, 'CAROUSEL', p_items -> 0 ->> 'path', p_items -> 0 ->> 'url',
    (select jsonb_agg(jsonb_build_object('path', e ->> 'path', 'url', e ->> 'url')) from jsonb_array_elements(p_items) e),
    coalesce(p_caption, ''), greatest(p_at, now()))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.schedule_ig_carousel(jsonb, text, timestamptz) from public, anon;
grant execute on function public.schedule_ig_carousel(jsonb, text, timestamptz) to authenticated;

-- A file is still needed while a waiting post uses it, as a single file or as one photo of a carousel
create or replace function public.ig_orphan_media()
returns table (name text) language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'ig-posts' and o.created_at < now() - interval '12 hours'
    and not exists (
      select 1 from public.ig_scheduled_posts p
      where p.status in ('scheduled', 'publishing')
        and (p.media_path = o.name or exists (select 1 from jsonb_array_elements(p.items) i where i ->> 'path' = o.name))
    )
  limit 500;
$$;
revoke execute on function public.ig_orphan_media() from public, anon, authenticated;
