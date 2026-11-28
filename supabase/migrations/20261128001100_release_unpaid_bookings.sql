-- A slot is held while a buyer is paying. If the payment never completes, the booking is cancelled so the slot is free again
-- and the creator never sees a session nobody paid for.
create or replace function public.release_unpaid_bookings()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  update public.bookings b
     set status = 'cancelled', cancel_reason = 'Payment not completed'
    from public.orders o
   where o.id = b.order_id and o.status in ('pending', 'failed')
     and b.status = 'confirmed' and b.created_at < now() - interval '30 minutes';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.release_unpaid_bookings() from public, anon, authenticated;

select public.release_unpaid_bookings();

select cron.unschedule(jobid) from cron.job where jobname = 'release-unpaid-bookings';
select cron.schedule('release-unpaid-bookings', '*/10 * * * *', $$select public.release_unpaid_bookings()$$);
