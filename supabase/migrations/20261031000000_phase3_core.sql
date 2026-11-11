-- =====================================================================
-- Phase 3 core: plans & pricing, multiple pages per account, team access,
-- multi-page sites (sub-pages), custom domains, referrals
-- =====================================================================

-- ---------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z0-9_]{2,20}$'),
  name text not null,
  description text not null default '',
  price_monthly_inr integer not null default 0 check (price_monthly_inr >= 0),
  price_yearly_inr integer not null default 0 check (price_yearly_inr >= 0),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  position integer not null default 0,
  updated_at timestamptz not null default now()
);
create trigger plans_updated_at before update on public.plans for each row execute function public.set_updated_at();

insert into public.plans (id, name, description, price_monthly_inr, price_yearly_inr, position, features) values
  ('free', 'Free', 'Everything you need to start', 0, 0, 0,
   '{"max_pages":1,"max_site_pages":3,"max_team":0,"max_products":10,"remove_branding":false,"custom_domain":false}'),
  ('pro', 'Pro', 'For growing creators', 149, 1490, 1,
   '{"max_pages":3,"max_site_pages":20,"max_team":3,"max_products":100,"remove_branding":true,"custom_domain":true}'),
  ('business', 'Business', 'For agencies and managers', 499, 4990, 2,
   '{"max_pages":20,"max_site_pages":50,"max_team":15,"max_products":500,"remove_branding":true,"custom_domain":true}');

alter table public.plans enable row level security;
create policy "plans: anyone reads" on public.plans for select using (true);
create policy "plans: admin writes" on public.plans for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.plans to anon, authenticated;
grant insert, update, delete on public.plans to authenticated;

-- Profiles: plan, referrals
alter table public.profiles
  add column plan text not null default 'free' references public.plans (id) on update cascade,
  add column plan_expires_at timestamptz,
  add column referral_code text unique,
  add column referred_by uuid references public.profiles (id) on delete set null,
  add column referral_credits integer not null default 0;

update public.profiles set referral_code = substr(md5(id::text || clock_timestamp()::text), 1, 8) where referral_code is null;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null references public.plans (id) on update cascade,
  period text not null check (period in ('month', 'year', 'referral', 'admin')),
  amount_inr integer not null default 0,
  provider text not null default 'test',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
alter table public.subscriptions enable row level security;
create policy "subscriptions: own or admin" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
grant select on public.subscriptions to authenticated;

-- Effective plan features (expired plans fall back to free)
create or replace function public.plan_features(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select pl.features from public.profiles pr
       join public.plans pl on pl.id = case when pr.plan_expires_at is null or pr.plan_expires_at > now() then pr.plan else 'free' end
      where pr.id = p_user),
    (select features from public.plans where id = 'free'),
    '{}'::jsonb);
$$;

create or replace function public.my_plan()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plan', case when pr.plan_expires_at is null or pr.plan_expires_at > now() then pr.plan else 'free' end,
    'expires_at', pr.plan_expires_at,
    'features', public.plan_features(pr.id))
  from public.profiles pr where pr.id = auth.uid();
$$;

-- Allows trusted functions to change protected profile fields
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('app.bypass_protect', true), '') <> 'on' then
    new.role := old.role;
    new.status := old.status;
    new.suspended_reason := old.suspended_reason;
    new.email := old.email;
    new.plan := old.plan;
    new.plan_expires_at := old.plan_expires_at;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.referral_credits := old.referral_credits;
  end if;
  return new;
end $$;

-- Test-mode upgrade (Razorpay subscriptions later)
create or replace function public.test_upgrade(p_plan text, p_period text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pl public.plans;
  pr public.profiles;
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_period not in ('month', 'year') then raise exception 'Invalid period' using errcode = 'P0001'; end if;
  select * into pl from public.plans where id = p_plan and is_active and id <> 'free';
  if not found then raise exception 'Plan not available' using errcode = 'P0001'; end if;
  select * into pr from public.profiles where id = auth.uid();
  v_start := case when pr.plan = p_plan and pr.plan_expires_at > now() then pr.plan_expires_at else now() end;
  v_end := v_start + case when p_period = 'year' then interval '1 year' else interval '1 month' end;
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set plan = p_plan, plan_expires_at = v_end where id = auth.uid();
  insert into public.subscriptions (user_id, plan, period, amount_inr, provider, starts_at, ends_at)
  values (auth.uid(), p_plan, p_period, case when p_period = 'year' then pl.price_yearly_inr else pl.price_monthly_inr end, 'test', v_start, v_end);
  return public.my_plan();
end $$;

create or replace function public.cancel_plan()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set plan = 'free', plan_expires_at = null where id = auth.uid();
  return public.my_plan();
end $$;

create or replace function public.admin_set_plan(p_user uuid, p_plan text, p_expires timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.profiles set plan = p_plan, plan_expires_at = case when p_plan = 'free' then null else p_expires end where id = p_user;
  if p_plan <> 'free' then
    insert into public.subscriptions (user_id, plan, period, amount_inr, provider, ends_at)
    values (p_user, p_plan, 'admin', 0, 'admin', p_expires);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Multiple pages per account + team access
-- ---------------------------------------------------------------------
alter table public.pages drop constraint pages_owner_id_key;
create index pages_owner_idx on public.pages (owner_id);

create table public.page_members (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id uuid references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (page_id, email)
);
create index page_members_user_idx on public.page_members (user_id) where user_id is not null;
create index page_members_email_idx on public.page_members (email) where user_id is null;

create or replace function public.page_role(p_page_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.pages where id = p_page_id and owner_id = auth.uid()) then 'owner'
    else (select role from public.page_members where page_id = p_page_id and user_id = auth.uid() and accepted_at is not null)
  end;
$$;
create or replace function public.can_view_page(p_page_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.page_role(p_page_id) is not null;
$$;
create or replace function public.can_edit_page(p_page_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.page_role(p_page_id) in ('owner', 'admin', 'editor'), false);
$$;
create or replace function public.can_manage_page(p_page_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.page_role(p_page_id) in ('owner', 'admin'), false);
$$;

alter table public.page_members enable row level security;
create policy "members: read" on public.page_members for select to authenticated
  using ((select public.can_view_page(page_id)) or email = lower((select auth.jwt()) ->> 'email'));
create policy "members: manage" on public.page_members for insert to authenticated
  with check ((select public.can_manage_page(page_id)));
create policy "members: update" on public.page_members for update to authenticated
  using ((select public.can_manage_page(page_id)));
create policy "members: remove" on public.page_members for delete to authenticated
  using ((select public.can_manage_page(page_id)) or user_id = (select auth.uid()));
grant select, insert, update, delete on public.page_members to authenticated;

create or replace function public.validate_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_max integer;
begin
  select owner_id into v_owner from public.pages where id = new.page_id;
  if tg_op = 'INSERT' then
    new.email := lower(trim(new.email));
    new.invited_by := auth.uid();
    new.user_id := null;
    new.accepted_at := null;
    v_max := coalesce((public.plan_features(v_owner) ->> 'max_team')::int, 0);
    if (select count(*) from public.page_members where page_id = new.page_id) >= v_max then
      raise exception 'Your plan allows % team member(s). Upgrade to invite more.', v_max using errcode = 'P0001';
    end if;
    if exists (select 1 from public.profiles where id = v_owner and lower(email) = new.email) then
      raise exception 'That’s the page owner’s email' using errcode = 'P0001';
    end if;
  else
    -- Only role can change through the API; acceptance happens in accept_invites()
    if coalesce(current_setting('app.bypass_protect', true), '') <> 'on' then
      new.email := old.email;
      new.user_id := old.user_id;
      new.accepted_at := old.accepted_at;
      new.page_id := old.page_id;
    end if;
  end if;
  return new;
end $$;
create trigger page_members_validate before insert or update on public.page_members
  for each row execute function public.validate_member();

create or replace function public.accept_invites()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_email text := lower((auth.jwt()) ->> 'email');
begin
  if auth.uid() is null or v_email is null then return 0; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update public.page_members set user_id = auth.uid(), accepted_at = now()
   where email = v_email and user_id is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- Multi-page sites: sub-pages under a creator page
-- ---------------------------------------------------------------------
create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$' and slug not in ('p', 'media-kit', 'order', 'home')),
  title text not null check (char_length(title) between 1 and 80),
  nav_label text check (char_length(nav_label) <= 30),
  position integer not null default 0,
  is_published boolean not null default true,
  show_in_nav boolean not null default true,
  visibility text not null default 'public' check (visibility in ('public', 'members')),
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, slug)
);
create trigger site_pages_updated_at before update on public.site_pages for each row execute function public.set_updated_at();

alter table public.blocks add column site_page_id uuid references public.site_pages (id) on delete cascade;
create index blocks_site_page_idx on public.blocks (page_id, site_page_id, position);

create or replace function public.validate_site_page()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_max integer;
begin
  new.slug := lower(new.slug);
  if tg_op = 'INSERT' then
    select owner_id into v_owner from public.pages where id = new.page_id;
    v_max := coalesce((public.plan_features(v_owner) ->> 'max_site_pages')::int, 3);
    if (select count(*) from public.site_pages where page_id = new.page_id) >= v_max then
      raise exception 'Your plan allows % extra pages. Upgrade to add more.', v_max using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger site_pages_validate before insert or update on public.site_pages
  for each row execute function public.validate_site_page();

-- A block may only belong to a sub-page of its own page
create or replace function public.validate_block_site_page()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.site_page_id is not null and not exists (
    select 1 from public.site_pages where id = new.site_page_id and page_id = new.page_id
  ) then
    raise exception 'Invalid sub-page' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger blocks_site_page_validate before insert or update on public.blocks
  for each row execute function public.validate_block_site_page();

-- ---------------------------------------------------------------------
-- Custom domains + plan enforcement on pages
-- ---------------------------------------------------------------------
alter table public.pages
  add column custom_domain text unique,
  add column domain_status text check (domain_status in ('pending', 'verified', 'active')),
  add column domain_token text,
  add column domain_verified_at timestamptz,
  add column billing jsonb not null default '{}'::jsonb;

create or replace function public.validate_page()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_features jsonb := public.plan_features(new.owner_id);
  v_trusted boolean := auth.uid() is null or public.is_admin()
                       or coalesce(current_setting('app.bypass_protect', true), '') = 'on';
begin
  new.username := lower(new.username);
  if exists (select 1 from public.reserved_usernames r where r.username = new.username) then
    raise exception 'This username is reserved' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    if not v_trusted and (select count(*) from public.pages where owner_id = new.owner_id)
         >= coalesce((v_features ->> 'max_pages')::int, 1) then
      raise exception 'Your plan allows % page(s). Upgrade to create more.', coalesce((v_features ->> 'max_pages')::int, 1)
        using errcode = 'P0001';
    end if;
  else
    new.owner_id := old.owner_id; -- ownership never changes via the API
  end if;

  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.published_at := coalesce(new.published_at, now());
  end if;

  -- Branding can only be removed on plans that include it
  if not coalesce((v_features ->> 'remove_branding')::boolean, false) then
    new.show_branding := true;
  end if;

  -- Custom domain
  new.custom_domain := nullif(lower(trim(trailing '.' from trim(coalesce(new.custom_domain, '')))), '');
  if new.custom_domain is not null then
    if new.custom_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$' then
      raise exception 'Enter a domain like links.yourname.com' using errcode = 'P0001';
    end if;
    if not coalesce((v_features ->> 'custom_domain')::boolean, false) and not v_trusted then
      raise exception 'Custom domains are available on Pro' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT' or new.custom_domain is distinct from old.custom_domain then
    if new.custom_domain is null then
      new.domain_status := null;
      new.domain_token := null;
    else
      new.domain_status := 'pending';
      new.domain_token := encode(extensions.gen_random_bytes(12), 'hex');
    end if;
    new.domain_verified_at := null;
  elsif not v_trusted then
    new.domain_status := old.domain_status;
    new.domain_token := old.domain_token;
    new.domain_verified_at := old.domain_verified_at;
  end if;

  -- Moderation fields are admin-only
  if tg_op = 'UPDATE' and not v_trusted then
    new.moderation_status := old.moderation_status;
    new.moderation_note := old.moderation_note;
  end if;
  return new;
end $$;

create or replace function public.get_page_by_domain(p_host text)
returns text language sql stable security definer set search_path = '' as $$
  select p.username from public.pages p join public.profiles o on o.id = p.owner_id
  where p.custom_domain = lower(p_host) and p.domain_status = 'active'
    and p.is_published and p.moderation_status = 'ok' and o.status = 'active';
$$;

-- ---------------------------------------------------------------------
-- Referrals
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ref uuid;
begin
  select id into v_ref from public.profiles
   where referral_code = lower(nullif(trim(new.raw_user_meta_data ->> 'ref'), ''));
  insert into public.profiles (id, email, full_name, referral_code, referred_by)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    substr(md5(new.id::text || clock_timestamp()::text), 1, 8),
    v_ref
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- For Google sign-ups (no metadata): claim within 2 days of joining
create or replace function public.claim_referral(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_ref uuid;
begin
  select id into v_ref from public.profiles where referral_code = lower(trim(p_code)) and id <> auth.uid();
  if v_ref is null then return false; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set referred_by = v_ref
   where id = auth.uid() and referred_by is null and created_at > now() - interval '2 days';
  return found;
end $$;

-- Reward: every 3 referred creators who publish a page = 1 month of Pro for the referrer
create or replace function public.referral_reward()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_referrer uuid;
  ref public.profiles;
begin
  if not (new.is_published and old.published_at is null and new.published_at is not null) then
    return new;
  end if;
  -- only the referred creator's first published page counts
  if exists (select 1 from public.pages where owner_id = new.owner_id and id <> new.id and published_at is not null) then
    return new;
  end if;
  select referred_by into v_referrer from public.profiles where id = new.owner_id;
  if v_referrer is null then return new; end if;

  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set referral_credits = referral_credits + 1 where id = v_referrer returning * into ref;
  if ref.referral_credits % 3 = 0 and ref.plan in ('free', 'pro') then
    update public.profiles
       set plan = 'pro',
           plan_expires_at = greatest(now(), case when plan = 'pro' then coalesce(plan_expires_at, now()) else now() end) + interval '30 days'
     where id = v_referrer;
    insert into public.subscriptions (user_id, plan, period, amount_inr, provider, ends_at)
    values (v_referrer, 'pro', 'referral', 0, 'referral', (select plan_expires_at from public.profiles where id = v_referrer));
  end if;
  return new;
end $$;
create trigger pages_referral_reward after update on public.pages
  for each row execute function public.referral_reward();

create or replace function public.referral_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select * from public.profiles where id = auth.uid()),
  refs as (
    select pr.id, pr.created_at, exists (select 1 from public.pages p where p.owner_id = pr.id and p.published_at is not null) as published
    from public.profiles pr where pr.referred_by = auth.uid()
  ),
  board as (
    select pr.referred_by as id, count(*) filter (where exists (select 1 from public.pages p where p.owner_id = pr.id and p.published_at is not null)) as n
    from public.profiles pr where pr.referred_by is not null group by pr.referred_by
  )
  select jsonb_build_object(
    'code', (select referral_code from me),
    'credits', (select referral_credits from me),
    'signups', (select count(*) from refs),
    'published', (select count(*) from refs where published),
    'rank', (select count(*) + 1 from board where n > coalesce((select n from board where id = auth.uid()), 0)),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('joined', created_at, 'published', published) order by created_at desc)
                        from (select * from refs order by created_at desc limit 20) r), '[]'::jsonb)
  );
$$;

create or replace function public.referral_leaderboard()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.referrals desc), '[]'::jsonb) from (
    select coalesce(nullif(pg.display_name, ''), split_part(pr.full_name, ' ', 1), 'Creator') as name,
           pg.username, pg.avatar_url, count(*) as referrals
    from public.profiles r
    join public.profiles pr on pr.id = r.referred_by
    left join lateral (select username, display_name, avatar_url from public.pages where owner_id = pr.id and is_published order by created_at limit 1) pg on true
    where exists (select 1 from public.pages p where p.owner_id = r.id and p.published_at is not null)
    group by pr.id, pg.display_name, pr.full_name, pg.username, pg.avatar_url
    order by count(*) desc
    limit 20
  ) t;
$$;

-- ---------------------------------------------------------------------
-- RLS rewrite: owner OR team member
-- ---------------------------------------------------------------------
drop policy "pages: read own or admin" on public.pages;
drop policy "pages: update own or admin" on public.pages;
create policy "pages: read" on public.pages for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.can_view_page(id)) or (select public.is_admin()));
create policy "pages: update" on public.pages for update to authenticated
  using ((select public.can_edit_page(id)) or (select public.is_admin()));

drop policy "blocks: owner all" on public.blocks;
create policy "blocks: team read" on public.blocks for select to authenticated using ((select public.can_view_page(page_id)));
create policy "blocks: team write" on public.blocks for insert to authenticated with check ((select public.can_edit_page(page_id)));
create policy "blocks: team update" on public.blocks for update to authenticated using ((select public.can_edit_page(page_id)));
create policy "blocks: team delete" on public.blocks for delete to authenticated using ((select public.can_edit_page(page_id)));

alter table public.site_pages enable row level security;
create policy "site_pages: team read" on public.site_pages for select to authenticated using ((select public.can_view_page(page_id)) or (select public.is_admin()));
create policy "site_pages: team write" on public.site_pages for insert to authenticated with check ((select public.can_edit_page(page_id)));
create policy "site_pages: team update" on public.site_pages for update to authenticated using ((select public.can_edit_page(page_id)));
create policy "site_pages: team delete" on public.site_pages for delete to authenticated using ((select public.can_edit_page(page_id)));
grant select, insert, update, delete on public.site_pages to authenticated;

drop policy "leads: owner read" on public.leads;
drop policy "leads: owner delete" on public.leads;
drop policy "leads: owner update" on public.leads;
create policy "leads: team read" on public.leads for select to authenticated using ((select public.can_view_page(page_id)) or (select public.is_admin()));
create policy "leads: team update" on public.leads for update to authenticated using ((select public.can_edit_page(page_id)));
create policy "leads: team delete" on public.leads for delete to authenticated using ((select public.can_edit_page(page_id)));

drop policy "page_daily: owner read" on public.page_daily;
drop policy "block_daily: owner read" on public.block_daily;
create policy "page_daily: team read" on public.page_daily for select to authenticated using ((select public.can_view_page(page_id)) or (select public.is_admin()));
create policy "block_daily: team read" on public.block_daily for select to authenticated using ((select public.can_view_page(page_id)) or (select public.is_admin()));

drop policy "instagram: read own or admin" on public.instagram_accounts;
create policy "instagram: owner, team or admin" on public.instagram_accounts for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin())
         or exists (select 1 from public.pages p where p.owner_id = instagram_accounts.owner_id and public.can_view_page(p.id)));

drop policy "enquiries: owner all" on public.enquiries;
create policy "enquiries: team read" on public.enquiries for select to authenticated using ((select public.can_view_page(page_id)));
create policy "enquiries: team write" on public.enquiries for insert to authenticated with check ((select public.can_edit_page(page_id)));
create policy "enquiries: team update" on public.enquiries for update to authenticated using ((select public.can_edit_page(page_id)));
create policy "enquiries: team delete" on public.enquiries for delete to authenticated using ((select public.can_edit_page(page_id)));

drop policy "products: owner all" on public.products;
create policy "products: team read" on public.products for select to authenticated using ((select public.can_view_page(page_id)));
create policy "products: team write" on public.products for insert to authenticated with check ((select public.can_edit_page(page_id)));
create policy "products: team update" on public.products for update to authenticated using ((select public.can_edit_page(page_id)));
create policy "products: team delete" on public.products for delete to authenticated using ((select public.can_edit_page(page_id)));

drop policy "coupons: owner all" on public.coupons;
create policy "coupons: team read" on public.coupons for select to authenticated using ((select public.can_view_page(page_id)));
create policy "coupons: team write" on public.coupons for insert to authenticated with check ((select public.can_edit_page(page_id)));
create policy "coupons: team update" on public.coupons for update to authenticated using ((select public.can_edit_page(page_id)));
create policy "coupons: team delete" on public.coupons for delete to authenticated using ((select public.can_edit_page(page_id)));

drop policy "orders: owner read" on public.orders;
create policy "orders: team read" on public.orders for select to authenticated
  using ((select public.can_view_page(page_id)) or (select public.is_admin()));

drop policy "bookings: owner read" on public.bookings;
drop policy "bookings: owner update" on public.bookings;
create policy "bookings: team read" on public.bookings for select to authenticated using ((select public.can_view_page(page_id)));
create policy "bookings: team update" on public.bookings for update to authenticated using ((select public.can_edit_page(page_id)));

-- Product owner always follows the page owner (team members create products for the owner)
create or replace function public.set_product_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
begin
  new.owner_id := (select owner_id from public.pages where id = new.page_id);
  if tg_op = 'INSERT' then
    v_max := coalesce((public.plan_features(new.owner_id) ->> 'max_products')::int, 10);
    if (select count(*) from public.products where page_id = new.page_id) >= v_max then
      raise exception 'Your plan allows % products. Upgrade to add more.', v_max using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger products_set_owner before insert or update on public.products
  for each row execute function public.set_product_owner();

-- Private product files live under <page owner id>/; team editors may write there
drop policy "product-files: owner read" on storage.objects;
drop policy "product-files: owner insert" on storage.objects;
drop policy "product-files: owner delete" on storage.objects;

create or replace function public.can_write_owner_folder(p_folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_folder = auth.uid()::text
      or exists (select 1 from public.pages p where p.owner_id::text = p_folder and public.can_edit_page(p.id));
$$;
create policy "product-files: team read" on storage.objects for select to authenticated
  using (bucket_id = 'product-files' and public.can_write_owner_folder((storage.foldername(name))[1]));
create policy "product-files: team insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-files' and public.can_write_owner_folder((storage.foldername(name))[1]));
create policy "product-files: team delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-files' and public.can_write_owner_folder((storage.foldername(name))[1]));

-- reorder_blocks: team editors too
create or replace function public.reorder_blocks(p_page_id uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit_page(p_page_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.blocks b set position = t.ord
    from unnest(p_ids) with ordinality as t(id, ord)
   where b.id = t.id and b.page_id = p_page_id;
end $$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on public.subscriptions, public.page_members, public.site_pages from anon;
revoke execute on function public.validate_member(), public.validate_site_page(), public.validate_block_site_page(),
  public.referral_reward(), public.set_product_owner() from public, anon, authenticated;
grant execute on function public.plan_features(uuid), public.get_page_by_domain(text) to anon, authenticated;
grant execute on function public.my_plan(), public.test_upgrade(text, text), public.cancel_plan(),
  public.admin_set_plan(uuid, text, timestamptz), public.accept_invites(), public.claim_referral(text),
  public.referral_stats(), public.referral_leaderboard(), public.page_role(uuid), public.can_view_page(uuid),
  public.can_edit_page(uuid), public.can_manage_page(uuid) to authenticated;
