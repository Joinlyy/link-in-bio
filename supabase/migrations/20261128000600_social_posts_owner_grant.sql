-- The post list filters by owner_id, so the signed-in creator must be able to read that column of their own rows
grant select (owner_id) on public.social_posts to authenticated;
