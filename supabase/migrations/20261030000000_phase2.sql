-- =====================================================================
-- Phase 2: storage, scheduling, new blocks, SEO/tracking, WhatsApp chat,
-- brand enquiries, support messages, audit log, products, orders (test
-- payments), coupons, 1:1 bookings, webinars, tips, DM automation
-- =====================================================================

-- ---------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creator-images', 'creator-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Private files sold as digital products (no video)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-files', 'product-files', false, 104857600,
  array[
    'application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/epub+zip',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/vnd.adobe.photoshop',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    'text/plain', 'text/csv', 'audio/mpeg', 'application/octet-stream', 'application/x-rar-compressed'
  ]
)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Creators write only inside their own folder: <user id>/...
create policy "creator-images: public read" on storage.objects for select
  using (bucket_id = 'creator-images');
create policy "creator-images: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'creator-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "creator-images: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'creator-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "creator-images: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'creator-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "product-files: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'product-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "product-files: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "product-files: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- Pages: SEO, tracking pixels, WhatsApp chat
-- ---------------------------------------------------------------------
alter table public.pages
  add column seo jsonb not null default '{}'::jsonb,
  add column tracking jsonb not null default '{}'::jsonb,
  add column whatsapp jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------
-- Blocks: scheduling + new types
-- ---------------------------------------------------------------------
alter table public.blocks
  add column starts_at timestamptz,
  add column ends_at timestamptz;

alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check check (type in (
  'link', 'whatsapp', 'youtube', 'instagram', 'spotify', 'text', 'heading', 'divider', 'image',
  'webinar', 'lead_form', 'countdown', 'faq', 'testimonials', 'enquiry', 'products', 'tip'
));

-- ---------------------------------------------------------------------
-- Leads: tags
-- ---------------------------------------------------------------------
alter table public.leads add column tags text[] not null default '{}';
create policy "leads: owner update" on public.leads for update to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())));
grant update (tags) on public.leads to authenticated;

-- ---------------------------------------------------------------------
-- Brand enquiries ("Work with me") + deal pipeline
-- ---------------------------------------------------------------------
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  brand_name text not null check (char_length(brand_name) <= 120),
  contact_name text check (char_length(contact_name) <= 120),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 20),
  budget text check (char_length(budget) <= 60),
  message text check (char_length(message) <= 2000),
  stage text not null default 'enquiry'
    check (stage in ('enquiry', 'negotiation', 'confirmed', 'delivered', 'paid', 'lost')),
  amount_inr integer check (amount_inr >= 0),
  due_date date,
  deliverables jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index enquiries_page_idx on public.enquiries (page_id, created_at desc);
create trigger enquiries_updated_at before update on public.enquiries
  for each row execute function public.set_updated_at();

alter table public.enquiries enable row level security;
create policy "enquiries: owner all" on public.enquiries for all to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())));
grant select, insert, update, delete on public.enquiries to authenticated;

create or replace function public.submit_enquiry(
  p_page_id uuid, p_brand text, p_name text, p_email text, p_phone text, p_budget text, p_message text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  if coalesce(trim(p_brand), '') = '' then raise exception 'Brand name is required' using errcode = 'P0001'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.pages where id = p_page_id and is_published and moderation_status = 'ok') then
    raise exception 'Page not found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.enquiries where page_id = p_page_id and email = v_email
       and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'You have already sent an enquiry. The creator will get back to you.' using errcode = 'P0001';
  end if;
  insert into public.enquiries (page_id, brand_name, contact_name, email, phone, budget, message)
  values (p_page_id, left(trim(p_brand), 120), left(nullif(trim(p_name), ''), 120), v_email,
          left(nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), 20),
          left(nullif(trim(p_budget), ''), 60), left(p_message, 2000));
end $$;

-- ---------------------------------------------------------------------
-- Creator <-> super admin messages
-- ---------------------------------------------------------------------
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  sender text not null check (sender in ('creator', 'admin')),
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index support_messages_creator_idx on public.support_messages (creator_id, created_at);

alter table public.support_messages enable row level security;
create policy "support: read own or admin" on public.support_messages for select to authenticated
  using (creator_id = (select auth.uid()) or (select public.is_admin()));
create policy "support: creator writes own" on public.support_messages for insert to authenticated
  with check ((creator_id = (select auth.uid()) and sender = 'creator') or ((select public.is_admin()) and sender = 'admin'));
create policy "support: mark read" on public.support_messages for update to authenticated
  using (creator_id = (select auth.uid()) or (select public.is_admin()));
grant select, insert on public.support_messages to authenticated;
grant update (read_at) on public.support_messages to authenticated;

-- ---------------------------------------------------------------------
-- Admin audit log
-- ---------------------------------------------------------------------
create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_table text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_created_idx on public.admin_audit (created_at desc);
alter table public.admin_audit enable row level security;
create policy "audit: admin read" on public.admin_audit for select to authenticated using ((select public.is_admin()));
grant select on public.admin_audit to authenticated;

create or replace function public.audit_admin_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
begin
  -- Only record changes made by admins (or the SQL editor), not creators editing their own data
  if v_actor is not null and not public.is_admin() then
    return coalesce(new, old);
  end if;
  -- Nested IFs: plpgsql does not short-circuit, so never touch columns of another table
  if tg_table_name = 'profiles' then
    if new.status is distinct from old.status or new.role is distinct from old.role then
      insert into public.admin_audit (actor_id, action, target_table, target_id, details)
      values (v_actor, case when new.role is distinct from old.role then 'role_change' else 'status_' || new.status end,
              'profiles', new.id::text,
              jsonb_build_object('email', new.email, 'from', old.status, 'to', new.status, 'role', new.role, 'reason', new.suspended_reason));
    end if;
  elsif tg_table_name = 'pages' then
    if new.moderation_status is distinct from old.moderation_status then
      insert into public.admin_audit (actor_id, action, target_table, target_id, details)
      values (v_actor, 'page_' || new.moderation_status, 'pages', new.id::text,
              jsonb_build_object('username', new.username, 'note', new.moderation_note));
    end if;
  elsif tg_table_name = 'reports' then
    if new.status is distinct from old.status then
      insert into public.admin_audit (actor_id, action, target_table, target_id, details)
      values (v_actor, 'report_' || new.status, 'reports', new.id::text, jsonb_build_object('reason', new.reason));
    end if;
  elsif tg_table_name = 'blocked_domains' then
    if tg_op = 'DELETE' then
      insert into public.admin_audit (actor_id, action, target_table, target_id, details)
      values (v_actor, 'domain_unblocked', 'blocked_domains', old.domain, jsonb_build_object('reason', old.reason));
    else
      insert into public.admin_audit (actor_id, action, target_table, target_id, details)
      values (v_actor, 'domain_blocked', 'blocked_domains', new.domain, jsonb_build_object('reason', new.reason));
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger profiles_audit after update on public.profiles for each row execute function public.audit_admin_change();
create trigger pages_audit after update on public.pages for each row execute function public.audit_admin_change();
create trigger reports_audit after update on public.reports for each row execute function public.audit_admin_change();
create trigger blocked_domains_audit after insert or delete on public.blocked_domains for each row execute function public.audit_admin_change();

-- ---------------------------------------------------------------------
-- Products: digital downloads, external links, 1:1 sessions, webinars
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('digital', 'link', 'session', 'webinar')),
  title text not null default '' check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 4000),
  thumbnail_url text,
  price_inr integer not null default 0 check (price_inr >= 0 and price_inr <= 1000000),
  compare_at_inr integer check (compare_at_inr >= 0),
  pay_what_you_want boolean not null default false,
  min_price_inr integer not null default 0 check (min_price_inr >= 0),
  -- Public, type-specific settings (session duration & availability, webinar date, link url, etc.)
  data jsonb not null default '{}'::jsonb,
  -- Never shown publicly: meeting links, delivery notes. Revealed only on a paid order.
  private jsonb not null default '{}'::jsonb,
  file_path text,
  file_name text,
  file_size bigint,
  is_published boolean not null default false,
  position integer not null default 0,
  sales_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_page_idx on public.products (page_id, position);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;
create policy "products: owner all" on public.products for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "products: admin read" on public.products for select to authenticated using ((select public.is_admin()));
grant select, insert, update, delete on public.products to authenticated;

create or replace function public.validate_product()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_url text := nullif(trim(new.data ->> 'url'), '');
begin
  if v_url is not null then
    if v_url !~* '^https?://[^\s]+$' then
      raise exception 'Product links must start with http:// or https://' using errcode = 'P0001';
    end if;
    if public.is_url_blocked(v_url) then
      raise exception 'This link has been blocked for safety reasons' using errcode = 'P0001';
    end if;
  end if;
  if new.file_path is not null and split_part(new.file_path, '/', 1) <> new.owner_id::text then
    raise exception 'Invalid file' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger products_validate before insert or update on public.products
  for each row execute function public.validate_product();

-- Coupons
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{3,24}$'),
  percent_off integer check (percent_off between 1 and 100),
  amount_off_inr integer check (amount_off_inr > 0),
  max_uses integer check (max_uses > 0),
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (page_id, code),
  check ((percent_off is not null) <> (amount_off_inr is not null))
);
alter table public.coupons enable row level security;
create policy "coupons: owner all" on public.coupons for all to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())));
grant select, insert, update, delete on public.coupons to authenticated;

-- Orders (payments are simulated until Razorpay/Cashfree is connected)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  kind text not null default 'product' check (kind in ('product', 'tip')),
  product_title text,
  product_type text,
  buyer_name text check (char_length(buyer_name) <= 120),
  buyer_email text not null check (char_length(buyer_email) <= 200),
  buyer_phone text check (char_length(buyer_phone) <= 20),
  note text check (char_length(note) <= 500),
  amount_inr integer not null check (amount_inr >= 0),
  discount_inr integer not null default 0,
  coupon_code text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  payment_provider text not null default 'test',
  payment_ref text,
  access_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  downloads integer not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_page_created_idx on public.orders (page_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);

alter table public.orders enable row level security;
create policy "orders: owner read" on public.orders for select to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid()))
         or (select public.is_admin()));
create policy "orders: admin update" on public.orders for update to authenticated using ((select public.is_admin()));
grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

-- 1:1 session bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  buyer_name text,
  buyer_email text not null,
  buyer_phone text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  cancel_reason text,
  created_at timestamptz not null default now()
);
create unique index bookings_no_double_booking on public.bookings (product_id, starts_at) where status <> 'cancelled';
create index bookings_page_starts_idx on public.bookings (page_id, starts_at);

alter table public.bookings enable row level security;
create policy "bookings: owner read" on public.bookings for select to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())));
create policy "bookings: owner update" on public.bookings for update to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and p.owner_id = (select auth.uid())));
grant select on public.bookings to authenticated;
grant update (status, cancel_reason) on public.bookings to authenticated;

-- Safe public projection of a product
create or replace function public.product_public_json(p public.products)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'title', p.title, 'description', p.description,
    'thumbnail_url', p.thumbnail_url, 'price_inr', p.price_inr, 'compare_at_inr', p.compare_at_inr,
    'pay_what_you_want', p.pay_what_you_want, 'min_price_inr', p.min_price_inr, 'data', p.data,
    'file_name', p.file_name, 'file_size', p.file_size
  );
$$;

-- Public page now also returns SEO, tracking, WhatsApp and published products; respects block schedules
create or replace function public.get_public_page(p_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'page', jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
      'avatar_url', p.avatar_url, 'niche', p.niche, 'language', p.language, 'theme', p.theme,
      'socials', p.socials, 'show_branding', p.show_branding, 'seo', p.seo, 'tracking', p.tracking,
      'whatsapp', case when coalesce((p.whatsapp ->> 'open')::boolean, false)
                       then p.whatsapp - 'open' else null end,
      'media_kit_enabled', coalesce((p.media_kit ->> 'enabled')::boolean, true)
    ),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'type', b.type, 'data', b.data) order by b.position, b.created_at)
      from public.blocks b
      where b.page_id = p.id and b.is_active
        and (b.starts_at is null or b.starts_at <= now())
        and (b.ends_at is null or b.ends_at > now())
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(public.product_public_json(pr) order by pr.position, pr.created_at)
      from public.products pr where pr.page_id = p.id and pr.is_published
    ), '[]'::jsonb)
  )
  from public.pages p
  join public.profiles o on o.id = p.owner_id
  where p.username = lower(p_username)
    and p.is_published and p.moderation_status = 'ok' and o.status = 'active';
$$;

create or replace function public.get_public_product(p_username text, p_product_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'page', jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
      'avatar_url', p.avatar_url, 'theme', p.theme, 'language', p.language, 'tracking', p.tracking),
    'product', public.product_public_json(pr),
    'booked', case when pr.type = 'session' then coalesce((
      select jsonb_agg(b.starts_at) from public.bookings b
      where b.product_id = pr.id and b.status <> 'cancelled' and b.starts_at > now()
    ), '[]'::jsonb) else '[]'::jsonb end,
    'seats_left', case when pr.type = 'webinar' and (pr.data ->> 'capacity') ~ '^\d+$'
      then greatest(0, (pr.data ->> 'capacity')::int - (
        select count(*) from public.orders o where o.product_id = pr.id and o.status = 'paid')::int)
      else null end
  )
  from public.products pr
  join public.pages p on p.id = pr.page_id
  join public.profiles o on o.id = p.owner_id
  where p.username = lower(p_username) and pr.id = p_product_id and pr.is_published
    and p.is_published and p.moderation_status = 'ok' and o.status = 'active';
$$;

-- Validate a coupon for a product (returns discount in rupees)
create or replace function public.coupon_discount(p_page_id uuid, p_product_id uuid, p_code text, p_price integer)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare
  c public.coupons;
begin
  select * into c from public.coupons
   where page_id = p_page_id and code = upper(trim(p_code)) and is_active
     and (product_id is null or product_id = p_product_id)
     and (expires_at is null or expires_at > now())
     and (max_uses is null or used_count < max_uses);
  if not found then
    raise exception 'This coupon is invalid or has expired' using errcode = 'P0001';
  end if;
  return least(p_price, coalesce(c.amount_off_inr, round(p_price * c.percent_off / 100.0)::int));
end $$;

-- TEST checkout. Replace with a Razorpay/Cashfree edge function + webhook later;
-- the webhook should flip status to 'paid' and run the same fulfilment steps.
create or replace function public.create_test_order(
  p_product_id uuid, p_name text, p_email text, p_phone text,
  p_amount integer default null, p_coupon text default null, p_slot timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pr public.products;
  v_email text := lower(trim(p_email));
  v_price integer;
  v_discount integer := 0;
  v_order public.orders;
  v_duration integer;
  v_capacity integer;
begin
  select * into pr from public.products where id = p_product_id and is_published;
  if not found or not exists (
    select 1 from public.pages p join public.profiles o on o.id = p.owner_id
    where p.id = pr.page_id and p.is_published and p.moderation_status = 'ok' and o.status = 'active'
  ) then
    raise exception 'This product is not available' using errcode = 'P0001';
  end if;
  if pr.type = 'link' then raise exception 'This product is sold on another website' using errcode = 'P0001'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email' using errcode = 'P0001'; end if;

  v_price := pr.price_inr;
  if pr.pay_what_you_want then
    v_price := greatest(coalesce(p_amount, pr.price_inr), pr.min_price_inr);
  end if;
  if nullif(trim(p_coupon), '') is not null then
    v_discount := public.coupon_discount(pr.page_id, pr.id, p_coupon, v_price);
  end if;

  if pr.type = 'webinar' and (pr.data ->> 'capacity') ~ '^\d+$' then
    v_capacity := (pr.data ->> 'capacity')::int;
    if (select count(*) from public.orders where product_id = pr.id and status = 'paid') >= v_capacity then
      raise exception 'Sorry, this webinar is full' using errcode = 'P0001';
    end if;
  end if;
  if pr.type = 'webinar' and (pr.data ->> 'starts_at') is not null
     and (pr.data ->> 'starts_at')::timestamptz < now() then
    raise exception 'This webinar has already started' using errcode = 'P0001';
  end if;

  if pr.type = 'session' then
    if p_slot is null or p_slot < now() + interval '1 hour' then
      raise exception 'Please pick an available time slot' using errcode = 'P0001';
    end if;
    v_duration := coalesce(nullif(pr.data ->> 'duration', '')::int, 30);
  end if;

  insert into public.orders (page_id, product_id, kind, product_title, product_type, buyer_name, buyer_email,
                             buyer_phone, amount_inr, discount_inr, coupon_code, status, payment_provider,
                             payment_ref, paid_at)
  values (pr.page_id, pr.id, 'product', pr.title, pr.type, left(nullif(trim(p_name), ''), 120), v_email,
          left(nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), 20),
          v_price - v_discount, v_discount, nullif(upper(trim(p_coupon)), ''), 'paid', 'test',
          'test_' || encode(extensions.gen_random_bytes(6), 'hex'), now())
  returning * into v_order;

  if pr.type = 'session' then
    begin
      insert into public.bookings (page_id, product_id, order_id, starts_at, ends_at, buyer_name, buyer_email, buyer_phone)
      values (pr.page_id, pr.id, v_order.id, p_slot, p_slot + make_interval(mins => v_duration),
              v_order.buyer_name, v_email, v_order.buyer_phone);
    exception when unique_violation then
      raise exception 'That slot was just booked. Please pick another time.' using errcode = 'P0001';
    end;
  end if;

  if v_order.coupon_code is not null then
    update public.coupons set used_count = used_count + 1 where page_id = pr.page_id and code = v_order.coupon_code;
  end if;
  update public.products set sales_count = sales_count + 1 where id = pr.id;

  return jsonb_build_object('token', v_order.access_token);
end $$;

create or replace function public.create_test_tip(
  p_page_id uuid, p_amount integer, p_name text, p_email text, p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
begin
  if p_amount is null or p_amount < 10 or p_amount > 100000 then
    raise exception 'Tips can be between ₹10 and ₹1,00,000' using errcode = 'P0001';
  end if;
  if lower(trim(p_email)) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.pages where id = p_page_id and is_published and moderation_status = 'ok') then
    raise exception 'Page not found' using errcode = 'P0001';
  end if;
  insert into public.orders (page_id, kind, product_title, buyer_name, buyer_email, note, amount_inr, status,
                             payment_provider, payment_ref, paid_at)
  values (p_page_id, 'tip', 'Tip', left(nullif(trim(p_name), ''), 120), lower(trim(p_email)), left(p_note, 500),
          p_amount, 'paid', 'test', 'test_' || encode(extensions.gen_random_bytes(6), 'hex'), now())
  returning access_token into v_token;
  return jsonb_build_object('token', v_token);
end $$;

-- Buyer receipt / access page (token is the secret)
create or replace function public.get_order(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order', jsonb_build_object('id', o.id, 'kind', o.kind, 'status', o.status, 'amount_inr', o.amount_inr,
      'discount_inr', o.discount_inr, 'buyer_name', o.buyer_name, 'buyer_email', o.buyer_email,
      'created_at', o.created_at, 'payment_ref', o.payment_ref, 'payment_provider', o.payment_provider,
      'product_title', o.product_title, 'product_type', o.product_type),
    'page', jsonb_build_object('username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'theme', p.theme),
    'product', case when pr.id is null then null else public.product_public_json(pr) end,
    'access', case when o.status = 'paid' and pr.id is not null then jsonb_build_object(
      'meeting_url', pr.private ->> 'meeting_url',
      'instructions', pr.private ->> 'instructions',
      'has_file', pr.file_path is not null
    ) else null end,
    'booking', (select jsonb_build_object('starts_at', b.starts_at, 'ends_at', b.ends_at, 'status', b.status)
                from public.bookings b where b.order_id = o.id limit 1)
  )
  from public.orders o
  join public.pages p on p.id = o.page_id
  left join public.products pr on pr.id = o.product_id
  where o.access_token = p_token;
$$;

-- ---------------------------------------------------------------------
-- Instagram DM automation
-- ---------------------------------------------------------------------
create table public.dm_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  trigger text not null check (trigger in ('comment', 'story_reply', 'dm_keyword')),
  keywords text[] not null default '{}',
  media_id text,
  comment_reply text check (char_length(comment_reply) <= 300),
  message text not null check (char_length(message) between 1 and 1000),
  button_title text check (char_length(button_title) <= 20),
  button_url text,
  is_active boolean not null default true,
  sent_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dm_rules_owner_idx on public.dm_rules (owner_id) where is_active;
create trigger dm_rules_updated_at before update on public.dm_rules
  for each row execute function public.set_updated_at();
alter table public.dm_rules enable row level security;
create policy "dm_rules: owner all" on public.dm_rules for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.dm_rules to authenticated;

create table public.dm_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  rule_id uuid references public.dm_rules (id) on delete set null,
  event text not null,              -- comment | story_reply | dm
  source_id text,                   -- comment id / message id (dedupe)
  ig_user_id text,
  ig_username text,
  status text not null,             -- sent | failed | skipped
  error text,
  created_at timestamptz not null default now()
);
create unique index dm_events_dedupe on public.dm_events (owner_id, source_id) where source_id is not null;
create index dm_events_owner_created_idx on public.dm_events (owner_id, created_at desc);
alter table public.dm_events enable row level security;
create policy "dm_events: owner read" on public.dm_events for select to authenticated
  using (owner_id = (select auth.uid()));
grant select on public.dm_events to authenticated;

-- ---------------------------------------------------------------------
-- Admin stats: include revenue
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
    'gmv_30d', (select coalesce(sum(amount_inr), 0) from public.orders where status = 'paid' and created_at > now() - interval '30 days'),
    'orders_30d', (select count(*) from public.orders where status = 'paid' and created_at > now() - interval '30 days'),
    'products', (select count(*) from public.products where is_published),
    'unread_messages', (select count(*) from public.support_messages where sender = 'creator' and read_at is null),
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

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on public.dm_events, public.admin_audit from anon;
revoke all on public.enquiries, public.support_messages, public.products, public.coupons,
  public.orders, public.bookings, public.dm_rules from anon;
revoke execute on function public.audit_admin_change(), public.validate_product() from public, anon, authenticated;
grant execute on function public.submit_enquiry(uuid, text, text, text, text, text, text),
  public.get_public_product(text, uuid), public.coupon_discount(uuid, uuid, text, integer),
  public.create_test_order(uuid, text, text, text, integer, text, timestamptz),
  public.create_test_tip(uuid, integer, text, text, text), public.get_order(text)
  to anon, authenticated;
