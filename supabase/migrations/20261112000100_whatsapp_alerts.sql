-- WhatsApp alerts from the platform's WhatsApp number.
-- Creators get alerts about orders, UPI payments to confirm, leads and brand enquiries; buyers who
-- opt in get told when their payment is confirmed or rejected.
-- The database only tells the `whatsapp` function that something changed. The function re-reads the
-- row, decides what to send and records each message once, so a forged call can't send anything new.

-- ---------------------------------------------------------------------------
-- Who gets alerts
-- ---------------------------------------------------------------------------
alter table public.pages
  add column if not exists alert_whatsapp text,
  add column if not exists alert_on boolean not null default false;
alter table public.pages drop constraint if exists pages_alert_whatsapp_check;
alter table public.pages add constraint pages_alert_whatsapp_check check (alert_whatsapp is null or alert_whatsapp ~ '^[0-9]{10,15}$');

-- A buyer's WhatsApp updates are opt-in at checkout
alter table public.orders add column if not exists wa_updates boolean not null default false;
grant select (wa_updates) on public.orders to authenticated;

-- ---------------------------------------------------------------------------
-- Every message sent, once per event
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                       -- e.g. upi_submitted:<order id>
  page_id uuid references public.pages (id) on delete cascade,
  event text not null,
  recipient text not null check (recipient in ('creator', 'buyer', 'test')),
  phone_last4 text,
  template text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  error text,
  wa_message_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notifications_page_idx on public.notifications (page_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy "notifications: team or admin read" on public.notifications for select to authenticated
  using ((select public.can_view_page(page_id)) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Checkout: buyers can opt in to WhatsApp updates
-- ---------------------------------------------------------------------------
drop function if exists public.checkout_order(uuid, text, text, text, integer, text, timestamptz, text);
create or replace function public.checkout_order(p_product_id uuid, p_name text, p_email text, p_phone text, p_amount integer default null,
  p_coupon text default null, p_slot timestamptz default null, p_question text default null, p_wa_updates boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_page uuid := (select page_id from public.products where id = p_product_id);
  r jsonb;
begin
  if public.page_payment_mode(v_page) = 'test' then
    r := public.create_test_order(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
  elsif public.page_payment_mode(v_page) = 'off' then
    -- Free things still work; anything with a price waits until the creator adds a UPI ID
    r := public.create_test_order_impl(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
    if (select amount_inr from public.orders where access_token = r ->> 'token') > 0 then
      raise exception 'This creator hasn’t set up payments yet' using errcode = 'P0001';
    end if;
    r := r || jsonb_build_object('upi', false);
  else
    if (select count(*) from public.orders where page_id = v_page and created_at > now() - interval '1 minute') >= 30 then
      raise exception 'Too many orders right now. Please try again in a minute.' using errcode = 'P0001';
    end if;
    r := public.create_test_order_impl(p_product_id, p_name, p_email, p_phone, p_amount, p_coupon, p_slot, p_question);
    r := public.make_upi_pending(r ->> 'token');
  end if;
  -- Only with a number to send to
  update public.orders set wa_updates = true
   where access_token = r ->> 'token' and coalesce(p_wa_updates, false) and buyer_phone is not null;
  return r;
end $$;
grant execute on function public.checkout_order(uuid, text, text, text, integer, text, timestamptz, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tell the whatsapp function when something worth an alert happens (async; never blocks the write)
-- ---------------------------------------------------------------------------
create or replace function public.notify_whatsapp(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/whatsapp',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('action', 'event', 'kind', p_kind, 'id', p_id),
    timeout_milliseconds := 20000
  );
exception when others then
  null; -- an alert must never break an order or a lead
end $$;
revoke execute on function public.notify_whatsapp(text, uuid) from public, anon, authenticated;

create or replace function public.orders_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.status = 'paid')
     or (tg_op = 'UPDATE' and (new.status is distinct from old.status
                               or (new.payment_ref is not null and old.payment_ref is null and new.payment_provider = 'upi'))) then
    perform public.notify_whatsapp('order', new.id);
  end if;
  return null;
end $$;
drop trigger if exists orders_notify on public.orders;
create trigger orders_notify after insert or update on public.orders for each row execute function public.orders_notify();

create or replace function public.leads_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_whatsapp('lead', new.id);
  return null;
end $$;
drop trigger if exists leads_notify on public.leads;
create trigger leads_notify after insert on public.leads for each row execute function public.leads_notify();

-- Brand form submissions arrive at the Enquiry stage; deals a creator adds start later and don't alert
create or replace function public.enquiries_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.stage = 'enquiry' then
    perform public.notify_whatsapp('enquiry', new.id);
  end if;
  return null;
end $$;
drop trigger if exists enquiries_notify on public.enquiries;
create trigger enquiries_notify after insert on public.enquiries for each row execute function public.enquiries_notify();
