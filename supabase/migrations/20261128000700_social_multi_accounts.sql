-- One creator can connect several places to post to on the same platform (Facebook Pages now, LinkedIn Pages later).
-- An "account" is one such place. Tokens and posts now point at the account they belong to.

-- ---------------------------------------------------------------------------
-- Accounts: Facebook added, several per platform
-- ---------------------------------------------------------------------------
alter table public.social_accounts drop constraint if exists social_accounts_platform_check;
alter table public.social_accounts add constraint social_accounts_platform_check check (platform in ('linkedin', 'youtube', 'facebook'));
alter table public.social_accounts drop constraint if exists social_accounts_owner_id_platform_key;
alter table public.social_accounts drop constraint if exists social_accounts_owner_platform_external_key;
alter table public.social_accounts add constraint social_accounts_owner_platform_external_key unique (owner_id, platform, external_id);
alter table public.social_accounts add column if not exists kind text not null default 'profile' check (kind in ('profile', 'page'));

-- ---------------------------------------------------------------------------
-- Tokens belong to an account
-- ---------------------------------------------------------------------------
alter table public.social_tokens add column if not exists account_id uuid references public.social_accounts (id) on delete cascade;
update public.social_tokens t set account_id = a.id from public.social_accounts a
 where a.owner_id = t.owner_id and a.platform = t.platform and t.account_id is null;
delete from public.social_tokens where account_id is null;
alter table public.social_tokens drop constraint if exists social_tokens_platform_check;
alter table public.social_tokens add constraint social_tokens_platform_check check (platform in ('linkedin', 'youtube', 'facebook'));
alter table public.social_tokens drop constraint if exists social_tokens_pkey;
alter table public.social_tokens alter column account_id set not null;
alter table public.social_tokens add constraint social_tokens_pkey primary key (account_id);

-- ---------------------------------------------------------------------------
-- Posts remember which account they go to
-- ---------------------------------------------------------------------------
alter table public.social_posts drop constraint if exists social_posts_platform_check;
alter table public.social_posts add constraint social_posts_platform_check check (platform in ('linkedin', 'youtube', 'facebook'));
alter table public.social_posts add column if not exists account_id uuid references public.social_accounts (id) on delete set null;
update public.social_posts p set account_id = a.id from public.social_accounts a
 where a.owner_id = p.owner_id and a.platform = p.platform and p.account_id is null;
grant select (account_id) on public.social_posts to authenticated;
grant select (id, kind) on public.social_accounts to authenticated;

-- ---------------------------------------------------------------------------
-- Scheduling picks the account (the creator's only one when not given)
-- ---------------------------------------------------------------------------
drop function if exists public.schedule_social_post(text, text, text, text, text, text, jsonb, timestamptz, uuid, jsonb);
create or replace function public.schedule_social_post(
  p_platform text, p_kind text, p_caption text, p_title text, p_path text, p_url text, p_items jsonb, p_at timestamptz,
  p_group uuid default null, p_options jsonb default '{}'::jsonb, p_account uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_acc uuid;
  v_day_max integer := coalesce((public.plan_features(auth.uid()) ->> 'ig_posts_per_day')::integer, 1);
  v_day date := (greatest(p_at, now()) at time zone 'Asia/Kolkata')::date;
  v_n integer;
  v_text_max integer := case when p_platform = 'youtube' then 5000 else 3000 end;
  it jsonb;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_platform not in ('linkedin', 'youtube', 'facebook') then raise exception 'Unknown platform' using errcode = 'P0001'; end if;
  select a.id into v_acc from public.social_accounts a
   where a.owner_id = v_uid and a.platform = p_platform and (p_account is null or a.id = p_account)
   order by a.connected_at limit 1;
  if v_acc is null then
    raise exception 'Connect your % account first (Automations, Accounts)', initcap(p_platform) using errcode = 'P0001';
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
  if (select count(*) from public.social_posts where owner_id = v_uid and account_id = v_acc and status in ('scheduled', 'publishing', 'published')
        and (scheduled_at at time zone 'Asia/Kolkata')::date = v_day) >= v_day_max then
    raise exception 'Your plan allows % post% a day to this account. Pick another day, or upgrade for more.', v_day_max, case when v_day_max = 1 then '' else 's' end using errcode = 'P0001';
  end if;
  insert into public.social_posts (group_id, owner_id, platform, account_id, kind, caption, title, media_path, media_url, items, options, scheduled_at)
  values (coalesce(p_group, gen_random_uuid()), v_uid, p_platform, v_acc, p_kind, coalesce(p_caption, ''), nullif(btrim(coalesce(p_title, '')), ''),
    case when p_kind = 'CAROUSEL' then p_items -> 0 ->> 'path' else p_path end,
    case when p_kind = 'CAROUSEL' then p_items -> 0 ->> 'url' else p_url end,
    case when p_kind = 'CAROUSEL' then (select jsonb_agg(jsonb_build_object('path', e ->> 'path', 'url', e ->> 'url')) from jsonb_array_elements(p_items) e) else '[]'::jsonb end,
    coalesce(p_options, '{}'::jsonb), greatest(p_at, now()))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.schedule_social_post(text, text, text, text, text, text, jsonb, timestamptz, uuid, jsonb, uuid) from public, anon;
grant execute on function public.schedule_social_post(text, text, text, text, text, text, jsonb, timestamptz, uuid, jsonb, uuid) to authenticated;
