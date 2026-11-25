-- External brand products and courses (type 'link') are sold on someone else's site, so they never need a payout account.
create or replace function public.products_require_kyc()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_paid boolean := new.type <> 'link' and (new.price_inr > 0 or new.pay_what_you_want);
  v_was_paid boolean := tg_op = 'UPDATE' and old.type <> 'link' and (old.price_inr > 0 or old.pay_what_you_want);
begin
  if auth.uid() is null or not v_paid then return new; end if; -- server code, free products and external links
  if tg_op = 'UPDATE' and v_was_paid and old.price_inr = new.price_inr and old.pay_what_you_want = new.pay_what_you_want
     and (new.is_published = old.is_published or not new.is_published) then
    return new; -- an edit that does not make anything newly payable
  end if;
  select owner_id into v_owner from public.pages where id = new.page_id;
  if not public.creator_can_sell(v_owner) then
    raise exception 'Finish your payout KYC first (Settings, Payouts). Paid products need a verified payout account.' using errcode = 'P0001';
  end if;
  return new;
end $$;
