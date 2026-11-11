-- The plan limit counts live products only. Deactivated products and drafts don't use it up,
-- so it is checked when a product goes live. A wider cap on the total stops unlimited drafts.
create or replace function public.set_product_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
begin
  new.owner_id := (select owner_id from public.pages where id = new.page_id);
  v_max := coalesce((public.plan_features(new.owner_id) ->> 'max_products')::int, 10);
  if tg_op = 'INSERT' and (select count(*) from public.products where page_id = new.page_id) >= v_max * 10 then
    raise exception 'You have too many products saved. Delete some you no longer need.' using errcode = 'P0001';
  end if;
  if new.is_published and (tg_op = 'INSERT' or not old.is_published)
     and (select count(*) from public.products where page_id = new.page_id and is_published) >= v_max then
    raise exception 'Your plan allows % live products. Deactivate one or upgrade to add more.', v_max using errcode = 'P0001';
  end if;
  return new;
end $$;
