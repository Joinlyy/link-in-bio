-- 1. A creator cannot be booked twice at the same time. The old rule only stopped the same product at the same minute,
--    so two different session products (or a 20 and a 40 minute product) could overlap. The error is a unique violation so the
--    checkout code that already handles "that slot was just booked" shows its friendly message.
create or replace function public.bookings_no_overlap()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'cancelled' and public.slot_overlaps(new.page_id, new.starts_at, new.ends_at, null) then
    raise exception 'That slot was just booked' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists bookings_no_overlap on public.bookings;
create trigger bookings_no_overlap before insert on public.bookings for each row execute function public.bookings_no_overlap();

-- 2. The "sold" number on a product is ours to keep. A creator editing a product could set it to anything and fake social proof
--    or change how many are left. Our own functions (checkout, refunds) still change it.
create or replace function public.products_keep_sales_count()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then new.sales_count := old.sales_count; end if;
  return new;
end $$;
drop trigger if exists products_keep_sales_count on public.products;
create trigger products_keep_sales_count before update on public.products for each row execute function public.products_keep_sales_count();
