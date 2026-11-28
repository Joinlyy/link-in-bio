-- A creator cannot delete their account while Joinlyy owes them money, or while buyers have paid for a session that has not happened yet.
create or replace function public.account_delete_blockers(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'balance', coalesce((public.creator_earnings(p_user) ->> 'balance')::numeric, 0),
    'sessions', (
      select count(*) from public.bookings b
        join public.pages p on p.id = b.page_id
        join public.orders o on o.id = b.order_id
       where p.owner_id = p_user and b.status = 'confirmed' and o.status = 'paid' and b.ends_at > now()),
    'webinars', (
      select count(distinct o.id) from public.orders o
        join public.pages p on p.id = o.page_id
        join public.products pr on pr.id = o.product_id
       where p.owner_id = p_user and o.status = 'paid' and pr.type = 'webinar'
         and nullif(pr.data ->> 'starts_at', '') is not null and (pr.data ->> 'starts_at')::timestamptz > now())
  );
$$;
revoke execute on function public.account_delete_blockers(uuid) from public, anon, authenticated;
grant execute on function public.account_delete_blockers(uuid) to service_role;
