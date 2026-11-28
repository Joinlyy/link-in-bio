-- A creator's "Refund" marks the order refunded and takes the buyer's access away, but the money is sent back by hand.
-- Until now nobody on our side was told, so a buyer could lose the product and not get the money.
-- Now every refund of a paid Razorpay order raises a high issue for the admin (Razorpay page), saying whether the creator
-- had already been paid out for it.
create or replace function public.refund_order(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_owner uuid;
  v_paid_out numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or not (public.can_edit_page(o.page_id) or public.is_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if o.status <> 'paid' then raise exception 'Only paid orders can be refunded' using errcode = 'P0001'; end if;
  select owner_id into v_owner from public.pages where id = o.page_id;
  v_paid_out := coalesce((public.creator_earnings(v_owner) ->> 'paid_out')::numeric, 0);
  update public.orders set status = 'refunded', refunded_at = now(), refund_reason = left(p_reason, 500), refunded_by = auth.uid()
   where id = o.id;
  update public.bookings set status = 'cancelled', cancel_reason = coalesce(cancel_reason, 'Refunded')
   where order_id = o.id and status = 'confirmed';
  if o.product_id is not null then
    update public.products set sales_count = greatest(sales_count - 1, 0) where id = o.product_id;
  end if;
  update public.disputes set status = 'resolved_refund' where order_id = o.id and status in ('open', 'creator_responded');
  if o.payment_provider = 'razorpay' then
    insert into public.billing_issues (kind, severity, user_id, rzp_payment_id, details)
    values ('order_refund_needed', 'high', v_owner, coalesce(o.payment_ref, o.id::text),
      jsonb_build_object('order', o.id, 'amount_inr', o.amount_inr, 'buyer', o.buyer_email, 'reason', left(coalesce(p_reason, ''), 200),
        'creator_already_paid_out_something', v_paid_out > 0,
        'note', 'Send the money back to the buyer from Razorpay, then resolve this. If the creator was already paid out for it, the amount is yours to recover.'))
    on conflict do nothing;
  end if;
end $$;
