-- Invoices for creators' sales. When an order is paid it gets a sequential invoice number and a frozen copy of the seller's details.
--   Creator with a GSTIN: tax invoice. The price the buyer paid includes GST, so it is split into taxable value + CGST + SGST.
--   Creator without a GSTIN: plain invoice with no GST lines at all.
-- Seller details come from pages.billing (Dashboard, Payouts, Tax and invoice details, the same details used for brand-deal invoices).

alter table public.orders add column if not exists invoice_no text;
alter table public.orders add column if not exists invoice jsonb;
create unique index if not exists orders_invoice_no_per_page on public.orders (page_id, invoice_no) where invoice_no is not null;

create table if not exists public.invoice_counters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  fy text not null,
  last integer not null default 0,
  primary key (user_id, fy)
);
alter table public.invoice_counters enable row level security;
revoke all on public.invoice_counters from anon, authenticated;

create or replace function public.issue_order_invoice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pg record;
  b jsonb;
  v_gstin text;
  v_rate numeric;
  v_prefix text;
  v_day date := (coalesce(new.paid_at, now()) at time zone 'Asia/Kolkata')::date;
  v_year integer;
  v_fy text;
  v_seq integer;
  v_total numeric := new.amount_inr;
  v_taxable numeric;
  v_gst numeric := 0;
  v_cgst numeric := 0;
  v_sgst numeric := 0;
  v_mode text;
begin
  select p.owner_id, p.display_name, p.username, p.billing into pg from public.pages p where p.id = new.page_id;
  b := coalesce(pg.billing, '{}'::jsonb);
  v_gstin := nullif(upper(trim(coalesce(b ->> 'gstin', ''))), '');
  v_rate := coalesce(nullif(b ->> 'gst_rate', '')::numeric, 18);
  v_prefix := regexp_replace(upper(coalesce(nullif(trim(b ->> 'invoice_prefix'), ''), 'INV')), '[^A-Z0-9-]', '', 'g') || 'S';
  v_year := case when extract(month from v_day) >= 4 then extract(year from v_day)::integer else extract(year from v_day)::integer - 1 end;
  v_fy := v_year || '-' || lpad(((v_year + 1) % 100)::text, 2, '0');

  insert into public.invoice_counters (user_id, fy, last) values (pg.owner_id, v_fy, 1)
  on conflict (user_id, fy) do update set last = public.invoice_counters.last + 1
  returning last into v_seq;

  if v_gstin is not null and v_rate > 0 then
    v_mode := 'intra';
    v_taxable := round(v_total / (1 + v_rate / 100), 2);
    v_gst := v_total - v_taxable;
    v_cgst := round(v_gst / 2, 2);
    v_sgst := v_gst - v_cgst;
  else
    v_mode := 'none';
    v_taxable := v_total;
  end if;

  new.invoice_no := v_prefix || '/' || v_fy || '/' || lpad(v_seq::text, 4, '0');
  new.invoice := jsonb_build_object(
    'no', new.invoice_no, 'date', v_day, 'fy', v_fy, 'mode', v_mode, 'rate', case when v_mode = 'none' then null else v_rate end,
    'taxable', v_taxable, 'cgst', v_cgst, 'sgst', v_sgst, 'igst', 0, 'total', v_total,
    'sac', coalesce(nullif(b ->> 'sac_code', ''), '999799'),
    'seller', jsonb_build_object(
      'name', coalesce(nullif(trim(b ->> 'legal_name'), ''), nullif(pg.display_name, ''), pg.username),
      'gstin', v_gstin, 'pan', nullif(b ->> 'pan', ''), 'address', nullif(b ->> 'address', ''),
      'state', nullif(b ->> 'state', ''), 'state_code', coalesce(nullif(b ->> 'state_code', ''), left(v_gstin, 2)),
      'email', nullif(b ->> 'email', ''), 'phone', nullif(b ->> 'phone', ''), 'page', pg.username));
  return new;
end $$;
revoke execute on function public.issue_order_invoice() from public, anon, authenticated;

drop trigger if exists orders_issue_invoice on public.orders;
create trigger orders_issue_invoice before update of status on public.orders
  for each row when (new.status = 'paid' and old.status is distinct from 'paid' and new.payment_provider = 'razorpay' and new.invoice is null)
  execute function public.issue_order_invoice();

-- The buyer opens their invoice with the order link
create or replace function public.get_order_invoice(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'invoice', o.invoice, 'status', o.status,
    'item', coalesce(nullif(o.product_title, ''), case when o.kind = 'tip' then 'Tip' else 'Order' end),
    'amount', o.amount_inr, 'discount', o.discount_inr, 'coupon', o.coupon_code, 'paid_at', o.paid_at,
    'buyer', jsonb_build_object('name', o.buyer_name, 'email', o.buyer_email),
    'payment_ref', o.payment_ref, 'order_ref', upper(left(o.id::text, 8)))
  from public.orders o where o.access_token = p_token and o.invoice is not null;
$$;
grant execute on function public.get_order_invoice(text) to anon, authenticated;

-- The creator opens the same invoice from Sales
create or replace function public.creator_order_invoice(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'invoice', o.invoice, 'status', o.status,
    'item', coalesce(nullif(o.product_title, ''), case when o.kind = 'tip' then 'Tip' else 'Order' end),
    'amount', o.amount_inr, 'discount', o.discount_inr, 'coupon', o.coupon_code, 'paid_at', o.paid_at,
    'buyer', jsonb_build_object('name', o.buyer_name, 'email', o.buyer_email),
    'payment_ref', o.payment_ref, 'order_ref', upper(left(o.id::text, 8)))
  from public.orders o where o.id = p_order_id and o.invoice is not null and public.can_edit_page(o.page_id);
$$;
revoke execute on function public.creator_order_invoice(uuid) from public, anon;
grant execute on function public.creator_order_invoice(uuid) to authenticated;
grant select (invoice_no) on public.orders to authenticated;
