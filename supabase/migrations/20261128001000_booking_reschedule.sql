-- Rescheduling a 1:1 session: the buyer or the creator can move it, the other side is emailed with a new calendar invite,
-- and a slot is only offered when none of the creator's sessions already use that time.

alter table public.bookings add column if not exists rescheduled_from timestamptz;
alter table public.bookings add column if not exists rescheduled_by text check (rescheduled_by in ('buyer', 'creator'));
alter table public.bookings add column if not exists rescheduled_at timestamptz;

-- True when any other confirmed session of this creator overlaps the time
create or replace function public.slot_overlaps(p_page uuid, p_start timestamptz, p_end timestamptz, p_except uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
     where b.page_id = p_page and b.status <> 'cancelled' and (p_except is null or b.id <> p_except)
       and b.starts_at < p_end and b.ends_at > p_start
  );
$$;
revoke execute on function public.slot_overlaps(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- Record the move and tell the email function
create or replace function public.bookings_moved()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.rescheduled_from := old.starts_at;
    new.rescheduled_at := now();
    new.rescheduled_by := coalesce(nullif(current_setting('app.moved_by', true), ''), 'creator');
  end if;
  return new;
end $$;
drop trigger if exists bookings_moved_before on public.bookings;
create trigger bookings_moved_before before update of starts_at on public.bookings for each row execute function public.bookings_moved();

create or replace function public.bookings_moved_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.starts_at is distinct from old.starts_at then perform public.notify_email('booking_moved', new.id::text); end if;
  return new;
end $$;
drop trigger if exists bookings_moved_after on public.bookings;
create trigger bookings_moved_after after update of starts_at on public.bookings for each row execute function public.bookings_moved_notify();

-- Buyer moves their own session (from the order page)
create or replace function public.reschedule_booking(p_token text, p_booking_id uuid, p_slot timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  b public.bookings;
  pr public.products;
  v_hours integer;
  v_end timestamptz;
begin
  select * into o from public.orders where access_token = p_token and status = 'paid';
  if not found then raise exception 'Order not found' using errcode = 'P0001'; end if;
  select * into b from public.bookings where id = p_booking_id and order_id = o.id and status = 'confirmed' for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0001'; end if;
  select * into pr from public.products where id = b.product_id;
  v_hours := coalesce(nullif(pr.data ->> 'reschedule_hours', '')::int, 24);
  if v_hours < 0 then raise exception 'This session can’t be rescheduled' using errcode = 'P0001'; end if;
  if b.starts_at < now() + make_interval(hours => v_hours) then
    raise exception 'Sessions can be rescheduled up to % hours before they start', v_hours using errcode = 'P0001';
  end if;
  if not public.session_slot_valid(pr.data, p_slot) then
    raise exception 'That time slot isn’t available' using errcode = 'P0001';
  end if;
  v_end := p_slot + make_interval(mins => coalesce(nullif(pr.data ->> 'duration', '')::int, 30));
  if public.slot_overlaps(b.page_id, p_slot, v_end, b.id) then
    raise exception 'That slot was just booked. Please pick another time.' using errcode = 'P0001';
  end if;
  perform set_config('app.moved_by', 'buyer', true);
  begin
    update public.bookings set starts_at = p_slot, ends_at = v_end where id = b.id;
  exception when unique_violation then
    raise exception 'That slot was just booked. Please pick another time.' using errcode = 'P0001';
  end;
end $$;

-- Creator moves a buyer's session (from the dashboard); the buyer is emailed
create or replace function public.creator_reschedule_booking(p_booking_id uuid, p_slot timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  pr public.products;
  v_end timestamptz;
begin
  select * into b from public.bookings where id = p_booking_id and status = 'confirmed' for update;
  if not found or not public.can_edit_page(b.page_id) then raise exception 'Booking not found' using errcode = 'P0001'; end if;
  select * into pr from public.products where id = b.product_id;
  if p_slot < now() + interval '30 minutes' then raise exception 'Pick a time in the future' using errcode = 'P0001'; end if;
  v_end := p_slot + make_interval(mins => coalesce(nullif(pr.data ->> 'duration', '')::int, 30));
  if public.slot_overlaps(b.page_id, p_slot, v_end, b.id) then
    raise exception 'You already have a session at that time. Pick another.' using errcode = 'P0001';
  end if;
  perform set_config('app.moved_by', 'creator', true);
  begin
    update public.bookings set starts_at = p_slot, ends_at = v_end where id = b.id;
  exception when unique_violation then
    raise exception 'You already have a session at that time. Pick another.' using errcode = 'P0001';
  end;
end $$;
revoke execute on function public.creator_reschedule_booking(uuid, timestamptz) from public, anon;
grant execute on function public.creator_reschedule_booking(uuid, timestamptz) to authenticated;

-- Slots shown to buyers leave out times used by any of the creator's sessions, not only this product's
do $$
declare
  d text;
  f regprocedure;
begin
  foreach f in array array['public.get_public_product(text, uuid)'::regprocedure, 'public.get_order(text)'::regprocedure] loop
    select pg_get_functiondef(f) into d;
    if d not like '%b.product_id = pr.id and b.status <> ''cancelled''%' then raise exception '% has no booked list to change', f; end if;
    d := replace(d, 'b.product_id = pr.id and b.status <> ''cancelled''', 'b.page_id = pr.page_id and b.status <> ''cancelled''');
    execute d;
  end loop;
end $$;
