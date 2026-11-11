-- =====================================================================
-- LinkInBio — core schema
-- Creators, public pages, blocks, Instagram, leads, analytics, moderation
-- =====================================================================


-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new; 
end $$;

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  role text not null default 'creator' check (role in ('creator', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_created_at_idx on public.profiles (created_at desc);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- New auth user -> profile row
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Creators can edit their name, never their own role/status
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only end-user API calls are restricted; SQL editor / service role (no auth.uid()) can change anything
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.suspended_reason := old.suspended_reason;
    new.email := old.email;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------
-- Reserved usernames
-- ---------------------------------------------------------------------
create table public.reserved_usernames (
  username text primary key
);

insert into public.reserved_usernames (username) values
  ('admin'), ('administrator'), ('api'), ('app'), ('auth'), ('assets'), ('blog'),
  ('dashboard'), ('help'), ('support'), ('signin'), ('signup'), ('login'), ('logout'),
  ('register'), ('onboarding'), ('settings'), ('privacy'), ('terms'), ('about'),
  ('pricing'), ('guides'), ('media-kit'), ('mediakit'), ('static'), ('www'), ('mail'),
  ('root'), ('system'), ('null'), ('undefined'), ('forgot-password'), ('reset-password'),
  ('instagram'), ('facebook'), ('whatsapp'), ('youtube'), ('meta'), ('google'),
  ('official'), ('team'), ('staff'), ('security'), ('legal'), ('status'), ('explore');

-- ---------------------------------------------------------------------
-- Pages (one public page per creator for MVP)
-- ---------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_url text,
  niche text,
  language text not null default 'en' check (language in ('en', 'hi')),
  theme jsonb not null default '{}'::jsonb,
  socials jsonb not null default '{}'::jsonb,
  media_kit jsonb not null default '{"enabled": true}'::jsonb,
  is_published boolean not null default false,
  show_branding boolean not null default true,
  moderation_status text not null default 'ok' check (moderation_status in ('ok', 'hidden')),
  moderation_note text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pages_created_at_idx on public.pages (created_at desc);

create trigger pages_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

create or replace function public.validate_page()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.username := lower(new.username);
  if exists (select 1 from public.reserved_usernames r where r.username = new.username) then
    raise exception 'This username is reserved' using errcode = 'P0001';
  end if;
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.published_at := now();
  end if;
  -- Only admins can change moderation fields
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_admin() then
    new.moderation_status := old.moderation_status;
    new.moderation_note := old.moderation_note;
  end if;
  return new;
end $$;

create trigger pages_validate before insert or update on public.pages
  for each row execute function public.validate_page();

create or replace function public.is_username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(p_username) ~ '^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$'
    and not exists (select 1 from public.reserved_usernames where username = lower(p_username))
    and not exists (
      select 1 from public.pages
      where username = lower(p_username)
        and owner_id is distinct from auth.uid()
    );
$$;

-- ---------------------------------------------------------------------
-- Blocked domains (malicious / phishing link checks)
-- ---------------------------------------------------------------------
create table public.blocked_domains (
  domain text primary key check (domain = lower(domain)),
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.url_host(p_url text)
returns text language sql immutable as $$
  select lower(substring(p_url from '^[a-zA-Z][a-zA-Z0-9+.-]*://(?:[^@/]*@)?([^/:?#]+)'));
$$;

create or replace function public.is_url_blocked(p_url text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocked_domains d
    where public.url_host(p_url) = d.domain
       or public.url_host(p_url) like '%.' || d.domain
  );
$$;

-- ---------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  type text not null check (type in (
    'link', 'whatsapp', 'youtube', 'instagram', 'spotify', 'text', 'heading',
    'divider', 'image', 'webinar', 'lead_form'
  )),
  position integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blocks_page_position_idx on public.blocks (page_id, position);

create trigger blocks_updated_at before update on public.blocks
  for each row execute function public.set_updated_at();

create or replace function public.validate_block()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_url text := nullif(trim(new.data ->> 'url'), '');
begin
  if pg_column_size(new.data) > 16384 then
    raise exception 'Block content is too large' using errcode = 'P0001';
  end if;
  if v_url is not null then
    if v_url !~* '^https?://[^\s]+$' then
      raise exception 'Links must start with http:// or https://' using errcode = 'P0001';
    end if;
    if public.is_url_blocked(v_url) then
      raise exception 'This link has been blocked for safety reasons' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger blocks_validate before insert or update on public.blocks
  for each row execute function public.validate_block();

create or replace function public.reorder_blocks(p_page_id uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.pages where id = p_page_id and owner_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.blocks b
     set position = t.ord
    from unnest(p_ids) with ordinality as t(id, ord)
   where b.id = t.id and b.page_id = p_page_id;
end $$;

-- ---------------------------------------------------------------------
-- Instagram (profile data readable by owner; tokens only by service role)
-- ---------------------------------------------------------------------
create table public.instagram_accounts (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  ig_user_id text not null,
  username text,
  name text,
  biography text,
  profile_picture_url text,
  account_type text,
  followers_count integer,
  follows_count integer,
  media_count integer,
  avg_likes numeric,
  avg_comments numeric,
  engagement_rate numeric,
  insights jsonb not null default '{}'::jsonb,
  recent_media jsonb not null default '[]'::jsonb,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now()
);

create table public.instagram_tokens (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  access_token text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.instagram_oauth_states (
  state text primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Leads (lead capture with consent)
-- ---------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  block_id uuid references public.blocks (id) on delete set null,
  name text check (char_length(name) <= 120),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 20),
  consent boolean not null,
  consent_text text not null,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index leads_page_created_idx on public.leads (page_id, created_at desc);

create or replace function public.submit_lead(
  p_page_id uuid, p_block_id uuid, p_name text, p_email text, p_phone text,
  p_consent boolean, p_consent_text text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  if not coalesce(p_consent, false) then
    raise exception 'Consent is required' using errcode = 'P0001';
  end if;
  if v_email is null and v_phone is null then
    raise exception 'Email or WhatsApp number is required' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email' using errcode = 'P0001';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{8,15}$' then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.pages p join public.profiles o on o.id = p.owner_id
    where p.id = p_page_id and p.is_published and p.moderation_status = 'ok' and o.status = 'active'
  ) then
    raise exception 'Page not found' using errcode = 'P0001';
  end if;
  -- Light abuse protection: same contact on same page at most 3 times / 10 min
  if (select count(*) from public.leads
       where page_id = p_page_id and created_at > now() - interval '10 minutes'
         and (email = v_email or phone = v_phone)) >= 3 then
    raise exception 'You have already submitted this form' using errcode = 'P0001';
  end if;

  insert into public.leads (page_id, block_id, name, email, phone, consent, consent_text)
  values (
    p_page_id,
    (select id from public.blocks where id = p_block_id and page_id = p_page_id),
    left(nullif(trim(p_name), ''), 120), v_email, v_phone, true, left(p_consent_text, 500)
  );
end $$;

-- ---------------------------------------------------------------------
-- Analytics: raw events + daily rollups
-- ---------------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  page_id uuid not null,
  block_id uuid,
  type text not null check (type in ('view', 'click')),
  visitor_id text,
  source text,
  device text,
  browser text,
  os text,
  created_at timestamptz not null default now()
);
create index events_page_created_idx on public.events (page_id, created_at);
create index events_created_brin on public.events using brin (created_at);

create table public.page_daily (
  page_id uuid not null references public.pages (id) on delete cascade,
  day date not null,
  views integer not null default 0,
  uniques integer not null default 0,
  clicks integer not null default 0,
  sources jsonb not null default '{}'::jsonb,
  devices jsonb not null default '{}'::jsonb,
  browsers jsonb not null default '{}'::jsonb,
  primary key (page_id, day)
);

create table public.block_daily (
  block_id uuid not null references public.blocks (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  day date not null,
  clicks integer not null default 0,
  primary key (block_id, day)
);
create index block_daily_page_day_idx on public.block_daily (page_id, day);

-- Public, anonymous event ingestion. Kept tiny: one indexed lookup + one insert.
create or replace function public.track_event(
  p_page_id uuid, p_type text, p_block_id uuid default null, p_visitor text default null,
  p_source text default null, p_device text default null, p_browser text default null, p_os text default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.events (page_id, block_id, type, visitor_id, source, device, browser, os)
  select p_page_id, p_block_id, p_type, left(p_visitor, 64), left(lower(p_source), 32),
         left(lower(p_device), 16), left(lower(p_browser), 24), left(lower(p_os), 16)
  where p_type in ('view', 'click')
    and exists (select 1 from public.pages where id = p_page_id and is_published);
$$;

-- Recompute daily aggregates for one IST day (optionally one page)
create or replace function public.rollup_events(p_day date, p_page_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_from timestamptz := (p_day::timestamp at time zone 'Asia/Kolkata');
  v_to   timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Kolkata');
begin
  insert into public.page_daily (page_id, day, views, uniques, clicks, sources, devices, browsers)
  with ev as (
    select e.* from public.events e
    join public.pages p on p.id = e.page_id
    where e.created_at >= v_from and e.created_at < v_to
      and (p_page_id is null or e.page_id = p_page_id)
  ),
  base as (
    select page_id,
           count(*) filter (where type = 'view') as views,
           count(distinct visitor_id) filter (where type = 'view') as uniques,
           count(*) filter (where type = 'click') as clicks
    from ev group by page_id
  ),
  src as (
    select page_id, jsonb_object_agg(k, n) as j from (
      select page_id, coalesce(source, 'direct') as k, count(*) as n
      from ev where type = 'view' group by 1, 2
    ) t group by page_id
  ),
  dev as (
    select page_id, jsonb_object_agg(k, n) as j from (
      select page_id, coalesce(device, 'unknown') as k, count(*) as n
      from ev where type = 'view' group by 1, 2
    ) t group by page_id
  ),
  br as (
    select page_id, jsonb_object_agg(k, n) as j from (
      select page_id, coalesce(browser, 'other') as k, count(*) as n
      from ev where type = 'view' group by 1, 2
    ) t group by page_id
  )
  select b.page_id, p_day, b.views, b.uniques, b.clicks,
         coalesce(src.j, '{}'), coalesce(dev.j, '{}'), coalesce(br.j, '{}')
  from base b
  left join src using (page_id)
  left join dev using (page_id)
  left join br using (page_id)
  on conflict (page_id, day) do update set
    views = excluded.views, uniques = excluded.uniques, clicks = excluded.clicks,
    sources = excluded.sources, devices = excluded.devices, browsers = excluded.browsers;

  insert into public.block_daily (block_id, page_id, day, clicks)
  select e.block_id, e.page_id, p_day, count(*)
  from public.events e
  join public.blocks bl on bl.id = e.block_id
  where e.type = 'click' and e.created_at >= v_from and e.created_at < v_to
    and (p_page_id is null or e.page_id = p_page_id)
  group by e.block_id, e.page_id
  on conflict (block_id, day) do update set clicks = excluded.clicks;
end $$;

-- Creator-triggered refresh of today's numbers for their own page only
create or replace function public.refresh_my_stats()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_page uuid;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select id into v_page from public.pages where owner_id = auth.uid();
  if v_page is null then return; end if;
  perform public.rollup_events(v_today, v_page);
  perform public.rollup_events(v_today - 1, v_page);
end $$;

-- ---------------------------------------------------------------------
-- Reports (moderation)
-- ---------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  reason text not null check (reason in ('spam', 'scam', 'phishing', 'adult', 'hate', 'impersonation', 'other')),
  details text check (char_length(details) <= 1000),
  reporter_email text check (char_length(reporter_email) <= 200),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index reports_status_created_idx on public.reports (status, created_at desc);

create or replace function public.report_page(
  p_page_id uuid, p_reason text, p_details text, p_email text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.pages where id = p_page_id) then
    raise exception 'Page not found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reports
       where page_id = p_page_id and created_at > now() - interval '1 minute') > 20 then
    return; -- silently drop floods
  end if;
  insert into public.reports (page_id, reason, details, reporter_email)
  values (p_page_id, p_reason, left(p_details, 1000), left(nullif(trim(p_email), ''), 200));
end $$;

-- ---------------------------------------------------------------------
-- Public read API (single round trip, cacheable via GET)
-- ---------------------------------------------------------------------
create or replace function public.get_public_page(p_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'page', jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
      'avatar_url', p.avatar_url, 'niche', p.niche, 'language', p.language, 'theme', p.theme,
      'socials', p.socials, 'show_branding', p.show_branding,
      'media_kit_enabled', coalesce((p.media_kit ->> 'enabled')::boolean, true)
    ),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'type', b.type, 'data', b.data) order by b.position, b.created_at)
      from public.blocks b where b.page_id = p.id and b.is_active
    ), '[]'::jsonb)
  )
  from public.pages p
  join public.profiles o on o.id = p.owner_id
  where p.username = lower(p_username)
    and p.is_published and p.moderation_status = 'ok' and o.status = 'active';
$$;

create or replace function public.get_media_kit(p_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'page', jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
      'avatar_url', p.avatar_url, 'niche', p.niche, 'language', p.language,
      'socials', p.socials, 'media_kit', p.media_kit
    ),
    'instagram', (
      select jsonb_build_object(
        'username', i.username, 'name', i.name, 'profile_picture_url', i.profile_picture_url,
        'followers_count', i.followers_count, 'follows_count', i.follows_count,
        'media_count', i.media_count, 'avg_likes', i.avg_likes, 'avg_comments', i.avg_comments,
        'engagement_rate', i.engagement_rate, 'insights', i.insights,
        'recent_media', i.recent_media, 'last_synced_at', i.last_synced_at
      ) from public.instagram_accounts i where i.owner_id = p.owner_id
    )
  )
  from public.pages p
  join public.profiles o on o.id = p.owner_id
  where p.username = lower(p_username)
    and p.is_published and p.moderation_status = 'ok' and o.status = 'active'
    and coalesce((p.media_kit ->> 'enabled')::boolean, true);
$$;

-- ---------------------------------------------------------------------
-- Admin helpers
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'creators', (select count(*) from public.profiles where role = 'creator'),
    'signups_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'pages', (select count(*) from public.pages),
    'published', (select count(*) from public.pages where is_published),
    'suspended', (select count(*) from public.profiles where status = 'suspended'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'instagram_connected', (select count(*) from public.instagram_accounts),
    'leads_7d', (select count(*) from public.leads where created_at > now() - interval '7 days'),
    'views_7d', (select coalesce(sum(views), 0) from public.page_daily where day > current_date - 7),
    'clicks_7d', (select coalesce(sum(clicks), 0) from public.page_daily where day > current_date - 7),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'signups', s, 'views', v) order by d), '[]')
      from (
        select g::date as d,
          (select count(*) from public.profiles where created_at::date = g::date) as s,
          (select coalesce(sum(views), 0) from public.page_daily where day = g::date) as v
        from generate_series(current_date - 29, current_date, interval '1 day') g
      ) t
    )
  );
end $$;

create or replace function public.admin_block_domain(p_domain text, p_reason text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_domain text := lower(trim(both '.' from trim(p_domain)));
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.blocked_domains (domain, reason) values (v_domain, p_reason)
  on conflict (domain) do update set reason = excluded.reason;
  -- Disable existing blocks pointing at this domain
  update public.blocks set is_active = false
   where is_active
     and (public.url_host(data ->> 'url') = v_domain or public.url_host(data ->> 'url') like '%.' || v_domain);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.pages enable row level security;
alter table public.blocks enable row level security;
alter table public.reserved_usernames enable row level security;
alter table public.blocked_domains enable row level security;
alter table public.instagram_accounts enable row level security;
alter table public.instagram_tokens enable row level security;
alter table public.instagram_oauth_states enable row level security;
alter table public.leads enable row level security;
alter table public.events enable row level security;
alter table public.page_daily enable row level security;
alter table public.block_daily enable row level security;
alter table public.reports enable row level security;

-- profiles
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update own or admin" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- pages
create policy "pages: read own or admin" on public.pages for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "pages: insert own" on public.pages for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "pages: update own or admin" on public.pages for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "pages: delete own" on public.pages for delete to authenticated
  using (owner_id = (select auth.uid()));

-- blocks
create policy "blocks: owner all" on public.blocks for all to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())));
create policy "blocks: admin read" on public.blocks for select to authenticated
  using ((select public.is_admin()));
create policy "blocks: admin update" on public.blocks for update to authenticated
  using ((select public.is_admin()));

-- blocked domains (admin only; checks run through security definer functions)
create policy "blocked_domains: admin all" on public.blocked_domains for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- instagram profile data
create policy "instagram: read own or admin" on public.instagram_accounts for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
-- instagram_tokens / instagram_oauth_states: no policies => service role only

-- leads
create policy "leads: owner read" on public.leads for select to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid()))
         or (select public.is_admin()));
create policy "leads: owner delete" on public.leads for delete to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())));

-- analytics rollups
create policy "page_daily: owner read" on public.page_daily for select to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid()))
         or (select public.is_admin()));
create policy "block_daily: owner read" on public.block_daily for select to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid()))
         or (select public.is_admin()));

-- reports
create policy "reports: admin read" on public.reports for select to authenticated
  using ((select public.is_admin()));
create policy "reports: admin update" on public.reports for update to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Grants (explicit so the Data API exposure is intentional)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.pages, public.blocks to authenticated;
grant select, insert, update, delete on public.blocked_domains to authenticated;
grant select on public.instagram_accounts to authenticated;
grant select, delete on public.leads to authenticated;
grant select on public.page_daily, public.block_daily to authenticated;
grant select, update on public.reports to authenticated;
revoke all on public.events, public.instagram_tokens, public.instagram_oauth_states,
  public.reserved_usernames from anon, authenticated;

revoke execute on function public.rollup_events(date, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.get_public_page(text), public.get_media_kit(text),
  public.track_event(uuid, text, uuid, text, text, text, text, text),
  public.submit_lead(uuid, uuid, text, text, text, boolean, text),
  public.report_page(uuid, text, text, text),
  public.is_username_available(text) to anon, authenticated;
grant execute on function public.reorder_blocks(uuid, uuid[]), public.refresh_my_stats(),
  public.admin_stats(), public.admin_block_domain(text, text) to authenticated;
