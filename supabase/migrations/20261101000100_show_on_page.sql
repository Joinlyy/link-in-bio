-- A published product can be sold by direct link while hidden from the creator's page
alter table public.products add column show_on_page boolean not null default true;

create or replace function public.product_public_json(p public.products)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'show_on_page', p.show_on_page, 'type', p.type, 'title', p.title, 'description', p.description,
    'thumbnail_url', p.thumbnail_url, 'price_inr', public.product_effective_price(p),
    'regular_price_inr', p.price_inr,
    'compare_at_inr', case when public.product_effective_price(p) < p.price_inr then p.price_inr else p.compare_at_inr end,
    'sale_ends_at', case when p.sale_price_inr is not null and p.sale_ends_at > now() then p.sale_ends_at end,
    'pay_what_you_want', p.pay_what_you_want, 'min_price_inr', p.min_price_inr,
    'data', p.data - 'upsell_price_inr',
    'file_name', p.file_name, 'file_size', p.file_size,
    'stock_left', case when p.stock is null then null else greatest(0, p.stock - (
      select count(*) from public.orders o where o.product_id = p.id and o.status = 'paid')::int) end,
    'bundle_items', case when p.type = 'bundle' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'type', b.type, 'thumbnail_url', b.thumbnail_url)), '[]'::jsonb)
      from public.products b
      where b.page_id = p.page_id and b.type in ('digital', 'content')
        and b.id::text in (select jsonb_array_elements_text(coalesce(p.data -> 'items', '[]'::jsonb)))
    ) end
  );
$$;
