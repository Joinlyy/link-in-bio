-- =====================================================================
-- Plans: Starter (free) / Creator ₹199 / Pro ₹399, agreed 16 Nov 2026.
--
-- Plan IDs stay as they were, because functions, the referral reward and profiles.plan use them:
--   id 'free'     → shown as Starter
--   id 'pro'      → shown as Creator
--   id 'business' → shown as Pro
--
-- Feature keys (null = unlimited / all):
--   max_pages, max_site_pages, max_team, max_products   counts
--   remove_branding, custom_domain                       booleans (unchanged)
--   commission_pct      our fee on sales; collected only via a Razorpay split (not live yet)
--   max_automations     active Instagram DM automations
--   dm_triggers         allowed automation triggers (["comment"] on Starter)
--   dm_advanced         follow to unlock, collect email/phone, follow-up DM
--   dm_monthly_limit    automatic DMs per calendar month (IST)
--   whatsapp            WhatsApp alerts to the creator and order updates to buyers
--   analytics_days      how far back analytics can be read
--   leads_export        CSV export of leads and audience
--   sales_tools         coupons, limited-time offers, pay what you want
--   advanced_products   bundles, memberships, upsells
--   gst_invoices        brand-deal GST invoices
--   tracking            Meta Pixel / Google Analytics on the public page, UTM link builder
--   support             'help' | 'email' | 'priority'
-- =====================================================================

update public.plans set
  name = 'Starter', description = 'Everything you need to start, free forever',
  price_monthly_inr = 0, price_yearly_inr = 0, position = 0, is_active = true,
  features = '{
    "max_pages": 1, "max_site_pages": 3, "max_team": 0, "max_products": 5,
    "remove_branding": false, "custom_domain": false, "commission_pct": 15,
    "max_automations": 10, "dm_triggers": ["comment"], "dm_advanced": false, "dm_monthly_limit": 1000,
    "whatsapp": false, "analytics_days": 7, "leads_export": false, "sales_tools": false,
    "advanced_products": false, "gst_invoices": false, "tracking": false, "support": "help"
  }'::jsonb,
  updated_at = now()
where id = 'free';

update public.plans set
  name = 'Creator', description = 'For creators who sell and grow',
  price_monthly_inr = 199, price_yearly_inr = 1990, position = 1, is_active = true,
  features = '{
    "max_pages": 2, "max_site_pages": 15, "max_team": 1, "max_products": 50,
    "remove_branding": true, "custom_domain": true, "commission_pct": 10,
    "max_automations": null, "dm_triggers": null, "dm_advanced": true, "dm_monthly_limit": null,
    "whatsapp": true, "analytics_days": 90, "leads_export": true, "sales_tools": true,
    "advanced_products": true, "gst_invoices": true, "tracking": true, "support": "email"
  }'::jsonb,
  updated_at = now()
where id = 'pro';

update public.plans set
  name = 'Pro', description = 'For full-time creators and teams',
  price_monthly_inr = 399, price_yearly_inr = 3990, position = 2, is_active = true,
  features = '{
    "max_pages": 5, "max_site_pages": 50, "max_team": 5, "max_products": null,
    "remove_branding": true, "custom_domain": true, "commission_pct": 5,
    "max_automations": null, "dm_triggers": null, "dm_advanced": true, "dm_monthly_limit": null,
    "whatsapp": true, "analytics_days": 365, "leads_export": true, "sales_tools": true,
    "advanced_products": true, "gst_invoices": true, "tracking": true, "support": "priority"
  }'::jsonb,
  updated_at = now()
where id = 'business';

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
-- Calls from the API by a creator (not admins, cron, edge functions or trusted functions) are limited
create or replace function public.plan_limited()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and not public.is_admin()
         and coalesce(current_setting('app.bypass_protect', true), '') <> 'on';
$$;

/** A boolean feature of the plan; missing keys count as not included */
create or replace function public.plan_has(p_features jsonb, p_key text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce((p_features ->> p_key)::boolean, false);
$$;

/** Features of a page owner's plan */
create or replace function public.page_plan_features(p_page uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.plan_features((select owner_id from public.pages where id = p_page));
$$;

/** First day of analytics this page's plan can read */
create or replace function public.analytics_start(p_page uuid)
returns date language sql stable security definer set search_path = '' as $$
  select current_date - greatest(coalesce((public.page_plan_features(p_page) ->> 'analytics_days')::int, 7), 1) + 1;
$$;

revoke execute on function public.plan_limited(), public.page_plan_features(uuid) from public, anon;
grant execute on function public.plan_has(jsonb, text), public.analytics_start(uuid) to authenticated;
grant execute on function public.page_plan_features(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Products: unlimited live products (null), plus paid-only selling tools
-- ---------------------------------------------------------------------
create or replace function public.set_product_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_f jsonb;
  v_max integer;
begin
  new.owner_id := (select owner_id from public.pages where id = new.page_id);
  v_f := public.plan_features(new.owner_id);
  v_max := case when jsonb_typeof(v_f -> 'max_products') = 'null' then null else coalesce((v_f ->> 'max_products')::int, 10) end;
  if v_max is null then return new; end if;
  if tg_op = 'INSERT' and (select count(*) from public.products where page_id = new.page_id) >= greatest(v_max * 10, 50) then
    raise exception 'You have too many products saved. Delete some you no longer need.' using errcode = 'P0001';
  end if;
  if new.is_published and (tg_op = 'INSERT' or not old.is_published)
     and (select count(*) from public.products where page_id = new.page_id and is_published) >= v_max then
    raise exception 'Your plan allows % live products. Deactivate one or upgrade to add more.', v_max using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Checked only for live products, and only for what changes, so a creator who moves to a smaller plan can
-- still edit and save existing products; they just can't switch on paid-only extras.
create or replace function public.products_plan_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_f jsonb;
  v_live boolean;
begin
  if not public.plan_limited() or not new.is_published then return new; end if;
  v_f := public.page_plan_features(new.page_id);
  v_live := tg_op = 'INSERT' or not old.is_published;

  if not public.plan_has(v_f, 'sales_tools') then
    if new.sale_price_inr is not null and (v_live or new.sale_price_inr is distinct from old.sale_price_inr) then
      raise exception 'Limited-time offers are on the Creator and Pro plans. Remove the offer price or upgrade.' using errcode = 'P0001';
    end if;
    if new.pay_what_you_want and (v_live or not old.pay_what_you_want) then
      raise exception 'Pay what you want is on the Creator and Pro plans. Turn it off or upgrade.' using errcode = 'P0001';
    end if;
  end if;

  if not public.plan_has(v_f, 'advanced_products') then
    if new.type in ('bundle', 'membership') and v_live then
      raise exception '% are on the Creator and Pro plans. Upgrade to publish this.',
        case new.type when 'bundle' then 'Bundles' else 'Memberships' end using errcode = 'P0001';
    end if;
    if nullif(new.data ->> 'upsell_product_id', '') is not null
       and (v_live or (new.data ->> 'upsell_product_id') is distinct from (old.data ->> 'upsell_product_id')) then
      raise exception 'Upsells are on the Creator and Pro plans. Remove the upsell or upgrade.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists products_plan on public.products;
create trigger products_plan before insert or update on public.products
  for each row execute function public.products_plan_check();

-- ---------------------------------------------------------------------
-- Coupons and GST invoices
-- ---------------------------------------------------------------------
create or replace function public.coupons_plan_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.plan_limited() and new.is_active and (tg_op = 'INSERT' or not old.is_active)
     and not public.plan_has(public.page_plan_features(new.page_id), 'sales_tools') then
    raise exception 'Coupons are on the Creator and Pro plans. Upgrade to create coupons.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists coupons_plan on public.coupons;
create trigger coupons_plan before insert or update on public.coupons
  for each row execute function public.coupons_plan_check();

create or replace function public.invoices_plan_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.plan_limited() and not public.plan_has(public.page_plan_features(new.page_id), 'gst_invoices') then
    raise exception 'GST invoices are on the Creator and Pro plans. Upgrade to create invoices.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists invoices_plan on public.invoices;
create trigger invoices_plan before insert on public.invoices
  for each row execute function public.invoices_plan_check();

-- ---------------------------------------------------------------------
-- Tracking pixels: kept as they are (never an error, so page autosave keeps working) and not served
-- on plans without them
-- ---------------------------------------------------------------------
create or replace function public.pages_plan_tracking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.plan_limited() and not public.plan_has(public.plan_features(new.owner_id), 'tracking') then
    new.tracking := case when tg_op = 'INSERT' then '{}'::jsonb else old.tracking end;
  end if;
  return new;
end $$;
drop trigger if exists pages_plan_tracking on public.pages;
create trigger pages_plan_tracking before insert or update of tracking on public.pages
  for each row execute function public.pages_plan_tracking();

-- ---------------------------------------------------------------------
-- Instagram DM automations
-- ---------------------------------------------------------------------
create or replace function public.dm_rules_plan_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_f jsonb;
  v_max integer;
begin
  if not public.plan_limited() or not new.is_active then return new; end if;
  v_f := public.plan_features(new.owner_id);

  if jsonb_typeof(v_f -> 'dm_triggers') = 'array' and not (v_f -> 'dm_triggers') ? new.trigger then
    raise exception 'Story reply and DM keyword automations are on the Creator and Pro plans. Upgrade to use them.' using errcode = 'P0001';
  end if;
  if not public.plan_has(v_f, 'dm_advanced')
     and (new.require_follow or new.collect is not null or nullif(trim(coalesce(new.follow_up_message, '')), '') is not null) then
    raise exception 'Follow to unlock, collecting emails or numbers, and follow-ups are on the Creator and Pro plans.' using errcode = 'P0001';
  end if;

  v_max := case when jsonb_typeof(v_f -> 'max_automations') = 'number' then (v_f ->> 'max_automations')::int end;
  if v_max is not null and (tg_op = 'INSERT' or not old.is_active)
     and (select count(*) from public.dm_rules where owner_id = new.owner_id and is_active and id <> new.id) >= v_max then
    raise exception 'Your plan allows % active automations. Turn one off or upgrade.', v_max using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists dm_rules_plan on public.dm_rules;
create trigger dm_rules_plan before insert or update on public.dm_rules
  for each row execute function public.dm_rules_plan_check();

/** Automatic DMs sent this calendar month (IST), counted against dm_monthly_limit */
create or replace function public.dm_sent_this_month(p_owner uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.dm_events
   where owner_id = p_owner and status = 'sent'
     and created_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
$$;
revoke execute on function public.dm_sent_this_month(uuid) from public, anon;
grant execute on function public.dm_sent_this_month(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Analytics history: daily rollups readable only within the plan's window
-- ---------------------------------------------------------------------
drop policy if exists "page_daily: team read" on public.page_daily;
create policy "page_daily: team read" on public.page_daily for select to authenticated
  using ((select public.is_admin()) or ((select public.can_view_page(page_id)) and day >= public.analytics_start(page_id)));
drop policy if exists "block_daily: team read" on public.block_daily;
create policy "block_daily: team read" on public.block_daily for select to authenticated
  using ((select public.is_admin()) or ((select public.can_view_page(page_id)) and day >= public.analytics_start(page_id)));
drop policy if exists "product_daily: team read" on public.product_daily;
create policy "product_daily: team read" on public.product_daily for select to authenticated
  using ((select public.is_admin()) or ((select public.can_view_page(page_id)) and day >= public.analytics_start(page_id)));

-- ---------------------------------------------------------------------
-- Public page: pixels only on plans that include them
-- ---------------------------------------------------------------------
create or replace function public.get_public_page(p_username text, p_slug text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page public.pages;
  v_sp public.site_pages;
  v_features jsonb;
  v_locked boolean := false;
begin
  select p.* into v_page from public.pages p join public.profiles o on o.id = p.owner_id
   where p.username = lower(p_username) and p.is_published and p.moderation_status = 'ok' and o.status = 'active';
  if not found then return null; end if;
  if nullif(p_slug, '') is not null then
    select * into v_sp from public.site_pages where page_id = v_page.id and slug = lower(p_slug) and is_published;
    if not found then return null; end if;
    v_locked := v_sp.visibility = 'members';
  end if;
  v_features := public.plan_features(v_page.owner_id);

  return jsonb_build_object(
    'page', jsonb_build_object(
      'id', v_page.id, 'username', v_page.username, 'display_name', v_page.display_name, 'bio', v_page.bio,
      'avatar_url', v_page.avatar_url, 'niche', v_page.niche, 'language', v_page.language, 'theme', v_page.theme,
      'socials', v_page.socials, 'seo', v_page.seo,
      'tracking', case when public.plan_has(v_features, 'tracking') then v_page.tracking else '{}'::jsonb end,
      'show_branding', v_page.show_branding or not coalesce((v_features ->> 'remove_branding')::boolean, false),
      'whatsapp', case when coalesce((v_page.whatsapp ->> 'open')::boolean, false) then v_page.whatsapp - 'open' end,
      'media_kit_enabled', coalesce((v_page.media_kit ->> 'enabled')::boolean, true)
    ),
    'nav', (select coalesce(jsonb_agg(jsonb_build_object('slug', s.slug, 'label', coalesce(nullif(s.nav_label, ''), s.title),
              'members', s.visibility = 'members') order by s.position, s.created_at), '[]'::jsonb)
            from public.site_pages s where s.page_id = v_page.id and s.is_published and s.show_in_nav and public.site_page_has_content(s.id)),
    'site_page', case when v_sp.id is null then null else jsonb_build_object(
      'id', v_sp.id, 'slug', v_sp.slug, 'title', v_sp.title, 'visibility', v_sp.visibility, 'seo', v_sp.seo) end,
    'locked', v_locked,
    'lead_popup', (select jsonb_build_object('id', b.id, 'type', b.type, 'data', b.data)
                   from public.blocks b
                   where b.page_id = v_page.id and b.site_page_id is null and b.type = 'lead_form' and b.is_active
                     and (b.data ->> 'sample') is distinct from 'true'
                     and (b.starts_at is null or b.starts_at <= now()) and (b.ends_at is null or b.ends_at > now())
                     and case when v_sp.id is null then b.data ->> 'popup' = 'true' else v_sp.lead_popup end
                   order by b.position, b.created_at limit 1),
    'blocks', case when v_locked then '[]'::jsonb else public.page_blocks_json(v_page.id, v_sp.id) end,
    'products', (select coalesce(jsonb_agg(public.product_public_json(pr) order by pr.position, pr.created_at), '[]'::jsonb)
                 from public.products pr where pr.page_id = v_page.id and pr.is_published),
    'latest_reel', (select m ->> 'permalink' from public.instagram_accounts i, jsonb_array_elements(i.recent_media) m
                    where i.owner_id = v_page.owner_id and (m ->> 'media_product_type' = 'REELS' or m ->> 'media_type' = 'VIDEO')
                    limit 1)
  );
end $$;

revoke execute on function public.products_plan_check(), public.coupons_plan_check(), public.invoices_plan_check(),
  public.pages_plan_tracking(), public.dm_rules_plan_check() from public, anon, authenticated;
