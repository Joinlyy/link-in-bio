-- One checkout_order only: the version with the WhatsApp opt-in, which is the one the app calls.
-- (An earlier migration of this series added a second, 8-argument copy; the app's call became ambiguous and the
--  9-argument copy still pointed at the removed UPI helper.)
drop function if exists public.checkout_order(uuid, text, text, text, integer, text, timestamptz, text);
drop function if exists public.checkout_order(uuid, text, text, text, integer, text, timestamptz, text, boolean);

create or replace function public.checkout_order(p_product_id uuid, p_name text, p_email text, p_phone text, p_amount integer default null,
  p_coupon text default null, p_slot timestamptz default null, p_question text default null, p_wa_updates boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_page uuid := (select page_id from public.products where id = p_product_id);
  v_mode text := public.page_payment_mode((select page_id from public.products where id = p_product_id));
  r jsonb;
begin
  if v_mode = 'test' then
    r := public.create_test_order(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
  else
    if (select count(*) from public.orders where page_id = v_page and created_at > now() - interval '1 minute') >= 30 then
      raise exception 'Too many orders right now. Please try again in a minute.' using errcode = 'P0001';
    end if;
    r := public.create_test_order_impl(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
    if (select amount_inr from public.orders where access_token = r ->> 'token') > 0 then
      -- Anything with a price waits until the creator has a payout UPI ID
      if v_mode = 'off' then raise exception 'This creator hasn’t set up payments yet' using errcode = 'P0001'; end if;
      r := public.make_route_pending(r ->> 'token');
    else
      r := r || jsonb_build_object('razorpay', false);
    end if;
  end if;
  -- Only with a number to send to
  update public.orders set wa_updates = true
   where access_token = r ->> 'token' and coalesce(p_wa_updates, false) and buyer_phone is not null;
  return r;
end $$;
grant execute on function public.checkout_order(uuid, text, text, text, integer, text, timestamptz, text, boolean) to anon, authenticated;
