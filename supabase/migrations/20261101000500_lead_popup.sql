-- The Home lead form can open as a popup: on Home through the form's own setting, and on any
-- other page through that page's setting.
alter table public.site_pages add column lead_popup boolean not null default false;

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
