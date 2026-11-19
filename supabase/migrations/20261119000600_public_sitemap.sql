-- Pages that may appear in the sitemap: published, not hidden by moderation, and not opted out of search engines.
-- Public: it returns only usernames and dates that are already public.
create or replace function public.public_sitemap()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('username', username, 'updated_at', updated_at) order by updated_at desc), '[]'::jsonb)
  from (
    select username, updated_at from public.pages
    where is_published and moderation_status = 'ok' and coalesce(seo ->> 'noindex', 'false') <> 'true'
    order by updated_at desc limit 20000
  ) p;
$$;
revoke execute on function public.public_sitemap() from public;
grant execute on function public.public_sitemap() to anon, authenticated;
