-- Visitors only see what a creator has really added. Template samples stay in the dashboard,
-- never reach the browser, and a menu page with nothing real on it stays out of the menu.
create or replace function public.page_blocks_json(p_page_id uuid, p_site_page_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'type', b.type, 'data', b.data - 'sample_products') order by b.position, b.created_at), '[]'::jsonb)
  from public.blocks b
  where b.page_id = p_page_id and b.site_page_id is not distinct from p_site_page_id and b.is_active
    and (b.type = 'products' or (b.data ->> 'sample') is distinct from 'true')
    and (b.starts_at is null or b.starts_at <= now())
    and (b.ends_at is null or b.ends_at > now());
$$;

create or replace function public.site_page_has_content(p_site_page_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks b
    where b.site_page_id = p_site_page_id and b.is_active
      and (b.starts_at is null or b.starts_at <= now())
      and (b.ends_at is null or b.ends_at > now())
      and case when b.type = 'products'
        then exists (select 1 from public.products pr where pr.page_id = b.page_id and pr.is_published and pr.show_on_page)
        else (b.data ->> 'sample') is distinct from 'true' end
  );
$$;
revoke execute on function public.site_page_has_content(uuid) from public, anon, authenticated;

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
      'socials', v_page.socials, 'seo', v_page.seo, 'tracking', v_page.tracking,
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
    'blocks', case when v_locked then '[]'::jsonb else public.page_blocks_json(v_page.id, v_sp.id) end,
    'products', (select coalesce(jsonb_agg(public.product_public_json(pr) order by pr.position, pr.created_at), '[]'::jsonb)
                 from public.products pr where pr.page_id = v_page.id and pr.is_published),
    'latest_reel', (select m ->> 'permalink' from public.instagram_accounts i, jsonb_array_elements(i.recent_media) m
                    where i.owner_id = v_page.owner_id and (m ->> 'media_product_type' = 'REELS' or m ->> 'media_type' = 'VIDEO')
                    limit 1)
  );
end $$;
