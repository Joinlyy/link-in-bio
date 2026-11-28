-- Edge cases around holding a slot or a seat while a buyer is paying.

-- 1. A payment can arrive after the 30-minute hold was released (slow UPI app, delayed bank confirmation, a reconcile run).
--    The buyer has paid, so give the session back if the time is still free. If someone else took it, raise an issue for the admin
--    and leave the order open so the buyer can pick a new time from their order page.
create or replace function public.orders_paid_restore_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    for b in select * from public.bookings where order_id = new.id and status = 'cancelled' and cancel_reason = 'Payment not completed' order by starts_at loop
      if b.starts_at < now() + interval '5 minutes' or public.slot_overlaps(b.page_id, b.starts_at, b.ends_at, b.id) then
        insert into public.billing_issues (kind, severity, rzp_payment_id, details)
        values ('booking_slot_lost', 'high', coalesce(new.payment_ref, new.id::text),
                jsonb_build_object('order', new.id, 'booking', b.id, 'wanted_slot', b.starts_at, 'buyer', new.buyer_email, 'note', 'Buyer paid after the slot hold ended and the time is no longer free. They can pick a new time on their order page.'))
        on conflict do nothing;
      else
        update public.bookings set status = 'confirmed', cancel_reason = null where id = b.id;
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists orders_paid_restore_booking on public.orders;
create trigger orders_paid_restore_booking after update of status on public.orders for each row execute function public.orders_paid_restore_booking();

-- 2. Webinar seats: a buyer who is still paying holds a seat for 30 minutes, so two people cannot both pay for the last seat
do $$
declare
  d text;
begin
  select pg_get_functiondef('public.create_test_order_impl(uuid, text, text, text, integer, text, timestamptz, text)'::regprocedure) into d;
  if d not like '%(select count(*) from public.orders where product_id = pr.id and status = ''paid'') >= (pr.data ->> ''capacity'')::int%' then
    raise exception 'webinar capacity check not found';
  end if;
  d := replace(d, '(select count(*) from public.orders where product_id = pr.id and status = ''paid'') >= (pr.data ->> ''capacity'')::int',
    '(select count(*) from public.orders where product_id = pr.id and (status = ''paid'' or (status = ''pending'' and created_at > now() - interval ''30 minutes''))) >= (pr.data ->> ''capacity'')::int');
  execute d;
end $$;
