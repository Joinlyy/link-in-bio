-- =====================================================================
-- Phase 3 commerce & analytics: bundles, paid content, memberships,
-- priority questions, session packages & rescheduling, limited offers,
-- upsells, refunds & disputes, fraud flags, GST invoices, audience
-- segments, UTM/geo/funnel analytics, DM lead collection, new blocks
-- =====================================================================

-- ---------------------------------------------------------------------
-- Blocks: locked content teaser + latest Reel
-- ---------------------------------------------------------------------
alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check check (type in (
  'link', 'whatsapp', 'youtube', 'instagram', 'spotify', 'text', 'heading', 'divider', 'image',
  'webinar', 'lead_form', 'countdown', 'faq', 'testimonials', 'enquiry', 'products', 'tip',
  'locked', 'latest_reel'
));

-- ---------------------------------------------------------------------
-- Products: new types, limited-time sale price, stock
-- ---------------------------------------------------------------------
alter table public.products drop constraint products_type_check;
alter table public.products add constraint products_type_check check (type in (
  'digital', 'link', 'session', 'webinar', 'bundle', 'content', 'membership', 'question'
));
alter table public.products
  add column sale_price_inr integer check (sale_price_inr >= 0),
  add column sale_ends_at timestamptz,
  add column stock integer check (stock >= 0);

create or replace function public.product_effective_price(p public.products)
returns integer language sql stable set search_path = '' as $$
  select case when p.sale_price_inr is not null and (p.sale_ends_at is null or p.sale_ends_at > now())
              then p.sale_price_inr else p.price_inr end;
$$;

create or replace function public.product_public_json(p public.products)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'title', p.title, 'description', p.description,
    'thumbnail_url', p.thumbnail_url, 'price_inr', public.product_effective_price(p),
    'regular_price_inr', p.price_inr,
    'compare_at_inr', case when public.product_effective_price(p) < p.price_inr then p.price_inr else p.compare_at_inr end,
    'sale_ends_at', case when p.sale_price_inr is not null and p.sale_ends_at > now() then p.sale_ends_at end,
    'pay_what_you_want', p.pay_what_you_want, 'min_price_inr', p.min_price_inr,
    'data', p.data - 'upsell_price_inr',
    'file_name', p.file_name, 'file_size', p.file_size,
    'stock_left', case when p.stock is null then null else greatest(0, p.stock - (
      select count(*) from public.orders o where o.product_id = p.id and o.status = 'paid')::int) end,
    'bundle_items', case when p.type = 'bundle' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'type', b.type, 'thumbnail_url', b.thumbnail_url)), '[]'::jsonb)
      from public.products b
      where b.page_id = p.page_id and b.type in ('digital', 'content')
        and b.id::text in (select jsonb_array_elements_text(coalesce(p.data -> 'items', '[]'::jsonb)))
    ) end
  );
$$;

-- Orders: question/answer, membership expiry, refunds, upsell link
alter table public.orders
  add column question text check (char_length(question) <= 1000),
  add column answer text check (char_length(answer) <= 4000),
  add column answered_at timestamptz,
  add column access_expires_at timestamptz,
  add column refunded_at timestamptz,
  add column refund_reason text,
  add column refunded_by uuid references public.profiles (id) on delete set null,
  add column upsell_of uuid references public.orders (id) on delete set null;
create index orders_product_status_idx on public.orders (product_id, status);
create index orders_buyer_idx on public.orders (lower(buyer_email), created_at desc);

-- ---------------------------------------------------------------------
-- 1:1 sessions: server-side slot validation, packages, buyer rescheduling
-- ---------------------------------------------------------------------
create or replace function public.session_slot_valid(p_data jsonb, p_slot timestamptz)
returns boolean language sql stable set search_path = '' as $$
  with s as (
    select (p_slot at time zone 'Asia/Kolkata') as l,
           coalesce(nullif(p_data ->> 'duration', '')::int, 30) as d,
           coalesce(nullif(p_data ->> 'buffer', '')::int, 0) as b
  ), w as (
    select (x ->> 'day')::int as day,
           split_part(x ->> 'start', ':', 1)::int * 60 + split_part(x ->> 'start', ':', 2)::int as ws,
           split_part(x ->> 'end', ':', 1)::int * 60 + split_part(x ->> 'end', ':', 2)::int as we
    from jsonb_array_elements(coalesce(p_data -> 'availability', '[]'::jsonb)) x
  )
  select exists (
    select 1 from s, w
    where extract(dow from s.l)::int = w.day
      and extract(second from s.l) = 0
      and (extract(hour from s.l) * 60 + extract(minute from s.l))::int >= w.ws
      and (extract(hour from s.l) * 60 + extract(minute from s.l))::int + s.d <= w.we
      and ((extract(hour from s.l) * 60 + extract(minute from s.l))::int - w.ws) % (s.d + s.b) = 0
  ) and p_slot >= now() + interval '1 hour'
    and p_slot <= now() + make_interval(days => least(coalesce(nullif(p_data ->> 'advance_days', '')::int, 14), 60) + 1);
$$;

-- ---------------------------------------------------------------------
-- Checkout (TEST MODE) — replaces the phase-2 version
-- ---------------------------------------------------------------------
drop function public.create_test_order(uuid, text, text, text, integer, text, timestamptz);

create or replace function public.create_test_order(
  p_product_id uuid, p_name text, p_email text, p_phone text,
  p_amount integer default null, p_coupon text default null, p_slot timestamptz default null,
  p_question text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pr public.products;
  v_email text := lower(trim(p_email));
  v_price integer;
  v_discount integer := 0;
  v_order public.orders;
  v_sessions integer;
  v_expires timestamptz;
begin
  -- Row lock serialises concurrent checkouts for stock / seats
  select * into pr from public.products where id = p_product_id and is_published for update;
  if not found or not exists (
    select 1 from public.pages p join public.profiles o on o.id = p.owner_id
    where p.id = pr.page_id and p.is_published and p.moderation_status = 'ok' and o.status = 'active'
  ) then
    raise exception 'This product is not available' using errcode = 'P0001';
  end if;
  if pr.type = 'link' then raise exception 'This product is sold on another website' using errcode = 'P0001'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email' using errcode = 'P0001'; end if;

  if pr.stock is not null and (select count(*) from public.orders where product_id = pr.id and status = 'paid') >= pr.stock then
    raise exception 'Sorry, this is sold out' using errcode = 'P0001';
  end if;

  v_price := public.product_effective_price(pr);
  if pr.pay_what_you_want then
    v_price := greatest(coalesce(p_amount, v_price), pr.min_price_inr);
  end if;
  if nullif(trim(p_coupon), '') is not null then
    v_discount := public.coupon_discount(pr.page_id, pr.id, p_coupon, v_price);
  end if;

  if pr.type = 'webinar' then
    if (pr.data ->> 'capacity') ~ '^\d+$' and
       (select count(*) from public.orders where product_id = pr.id and status = 'paid') >= (pr.data ->> 'capacity')::int then
      raise exception 'Sorry, this webinar is full' using errcode = 'P0001';
    end if;
    if nullif(pr.data ->> 'starts_at', '') is not null and (pr.data ->> 'starts_at')::timestamptz < now() then
      raise exception 'This webinar has already started' using errcode = 'P0001';
    end if;
  end if;

  if pr.type = 'session' then
    v_sessions := greatest(coalesce(nullif(pr.data ->> 'sessions', '')::int, 1), 1);
    if p_slot is null and v_sessions = 1 then
      raise exception 'Please pick a time slot' using errcode = 'P0001';
    end if;
    if p_slot is not null and not public.session_slot_valid(pr.data, p_slot) then
      raise exception 'That time slot isn’t available. Please pick another.' using errcode = 'P0001';
    end if;
  end if;

  if pr.type = 'question' and coalesce(trim(p_question), '') = '' then
    raise exception 'Please write your question' using errcode = 'P0001';
  end if;

  if pr.type = 'membership' then
    select greatest(now(), coalesce(max(access_expires_at), now())) into v_expires
      from public.orders where product_id = pr.id and lower(buyer_email) = v_email and status = 'paid';
    v_expires := v_expires + case when pr.data ->> 'interval' = 'year' then interval '1 year' else interval '1 month' end;
  end if;

  insert into public.orders (page_id, product_id, kind, product_title, product_type, buyer_name, buyer_email,
                             buyer_phone, amount_inr, discount_inr, coupon_code, status, payment_provider,
                             payment_ref, paid_at, question, access_expires_at)
  values (pr.page_id, pr.id, 'product', pr.title, pr.type, left(nullif(trim(p_name), ''), 120), v_email,
          left(nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), 20),
          v_price - v_discount, v_discount, nullif(upper(trim(p_coupon)), ''), 'paid', 'test',
          'test_' || encode(extensions.gen_random_bytes(6), 'hex'), now(),
          case when pr.type = 'question' then left(trim(p_question), 1000) end, v_expires)
  returning * into v_order;

  if pr.type = 'session' and p_slot is not null then
    begin
      insert into public.bookings (page_id, product_id, order_id, starts_at, ends_at, buyer_name, buyer_email, buyer_phone)
      values (pr.page_id, pr.id, v_order.id, p_slot,
              p_slot + make_interval(mins => coalesce(nullif(pr.data ->> 'duration', '')::int, 30)),
              v_order.buyer_name, v_email, v_order.buyer_phone);
    exception when unique_violation then
      raise exception 'That slot was just booked. Please pick another time.' using errcode = 'P0001';
    end;
  end if;

  if v_order.coupon_code is not null then
    update public.coupons set used_count = used_count + 1 where page_id = pr.page_id and code = v_order.coupon_code;
  end if;
  update public.products set sales_count = sales_count + 1 where id = pr.id;
  return jsonb_build_object('token', v_order.access_token);
end $$;

-- Book a session from a package order
create or replace function public.book_session(p_token text, p_slot timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  pr public.products;
begin
  select * into o from public.orders where access_token = p_token and status = 'paid';
  if not found then raise exception 'Order not found' using errcode = 'P0001'; end if;
  select * into pr from public.products where id = o.product_id and type = 'session' for update;
  if not found then raise exception 'This order is not a session' using errcode = 'P0001'; end if;
  if (select count(*) from public.bookings where order_id = o.id and status <> 'cancelled')
     >= greatest(coalesce(nullif(pr.data ->> 'sessions', '')::int, 1), 1) then
    raise exception 'All sessions in this package are already booked' using errcode = 'P0001';
  end if;
  if not public.session_slot_valid(pr.data, p_slot) then
    raise exception 'That time slot isn’t available' using errcode = 'P0001';
  end if;
  begin
    insert into public.bookings (page_id, product_id, order_id, starts_at, ends_at, buyer_name, buyer_email, buyer_phone)
    values (o.page_id, pr.id, o.id, p_slot, p_slot + make_interval(mins => coalesce(nullif(pr.data ->> 'duration', '')::int, 30)),
            o.buyer_name, o.buyer_email, o.buyer_phone);
  exception when unique_violation then
    raise exception 'That slot was just booked. Please pick another time.' using errcode = 'P0001';
  end;
end $$;

create or replace function public.reschedule_booking(p_token text, p_booking_id uuid, p_slot timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  b public.bookings;
  pr public.products;
  v_hours integer;
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
  begin
    update public.bookings
       set starts_at = p_slot, ends_at = p_slot + make_interval(mins => coalesce(nullif(pr.data ->> 'duration', '')::int, 30))
     where id = b.id;
  exception when unique_violation then
    raise exception 'That slot was just booked. Please pick another time.' using errcode = 'P0001';
  end;
end $$;

-- Priority questions
create or replace function public.answer_question(p_order_id uuid, p_answer text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id and product_type = 'question';
  if not found or not public.can_edit_page(o.page_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.orders set answer = left(trim(p_answer), 4000), answered_at = now() where id = o.id;
end $$;

-- One-click upsell on the order page
create or replace function public.accept_upsell(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  pr public.products;
  up public.products;
  v_price integer;
  v_new public.orders;
begin
  select * into o from public.orders where access_token = p_token and status = 'paid' and upsell_of is null;
  if not found then raise exception 'Order not found' using errcode = 'P0001'; end if;
  select * into pr from public.products where id = o.product_id;
  if nullif(pr.data ->> 'upsell_product_id', '') is null then raise exception 'No offer available' using errcode = 'P0001'; end if;
  if exists (select 1 from public.orders where upsell_of = o.id) then raise exception 'Offer already claimed' using errcode = 'P0001'; end if;
  select * into up from public.products
   where id = (pr.data ->> 'upsell_product_id')::uuid and page_id = pr.page_id and is_published
     and type in ('digital', 'content', 'bundle') for update;
  if not found then raise exception 'Offer no longer available' using errcode = 'P0001'; end if;
  v_price := coalesce(nullif(pr.data ->> 'upsell_price_inr', '')::int, public.product_effective_price(up));

  insert into public.orders (page_id, product_id, kind, product_title, product_type, buyer_name, buyer_email, buyer_phone,
                             amount_inr, status, payment_provider, payment_ref, paid_at, upsell_of)
  values (up.page_id, up.id, 'product', up.title, up.type, o.buyer_name, o.buyer_email, o.buyer_phone, v_price,
          'paid', 'test', 'test_' || encode(extensions.gen_random_bytes(6), 'hex'), now(), o.id)
  returning * into v_new;
  update public.products set sales_count = sales_count + 1 where id = up.id;
  return jsonb_build_object('token', v_new.access_token);
end $$;

-- ---------------------------------------------------------------------
-- Refunds & disputes
-- ---------------------------------------------------------------------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  reason text not null check (reason in ('not_received', 'not_as_described', 'session_missed', 'duplicate', 'other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'creator_responded', 'resolved_refund', 'resolved_rejected')),
  creator_response text check (char_length(creator_response) <= 2000),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index disputes_status_idx on public.disputes (status, created_at desc);
create index disputes_page_idx on public.disputes (page_id, created_at desc);
create trigger disputes_updated_at before update on public.disputes for each row execute function public.set_updated_at();
alter table public.disputes enable row level security;
create policy "disputes: team or admin read" on public.disputes for select to authenticated
  using ((select public.can_view_page(page_id)) or (select public.is_admin()));
grant select on public.disputes to authenticated;

create or replace function public.open_dispute(p_token text, p_reason text, p_details text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where access_token = p_token;
  if not found or o.status <> 'paid' then raise exception 'Only paid orders can be disputed' using errcode = 'P0001'; end if;
  if o.created_at < now() - interval '60 days' then raise exception 'Disputes must be raised within 60 days' using errcode = 'P0001'; end if;
  if exists (select 1 from public.disputes where order_id = o.id and status in ('open', 'creator_responded')) then
    raise exception 'A dispute is already open for this order' using errcode = 'P0001';
  end if;
  insert into public.disputes (order_id, page_id, reason, details) values (o.id, o.page_id, p_reason, left(p_details, 2000));
end $$;

create or replace function public.respond_dispute(p_dispute_id uuid, p_response text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.disputes;
begin
  select * into d from public.disputes where id = p_dispute_id;
  if not found or not public.can_edit_page(d.page_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if d.status not in ('open', 'creator_responded') then raise exception 'This dispute is closed' using errcode = 'P0001'; end if;
  update public.disputes set creator_response = left(trim(p_response), 2000), status = 'creator_responded' where id = d.id;
end $$;

create or replace function public.refund_order(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or not (public.can_edit_page(o.page_id) or public.is_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if o.status <> 'paid' then raise exception 'Only paid orders can be refunded' using errcode = 'P0001'; end if;
  -- TEST MODE: no money moves. With Razorpay this also calls the refund API.
  update public.orders set status = 'refunded', refunded_at = now(), refund_reason = left(p_reason, 500), refunded_by = auth.uid()
   where id = o.id;
  update public.bookings set status = 'cancelled', cancel_reason = coalesce(cancel_reason, 'Refunded')
   where order_id = o.id and status = 'confirmed';
  if o.product_id is not null then
    update public.products set sales_count = greatest(sales_count - 1, 0) where id = o.product_id;
  end if;
  update public.disputes set status = 'resolved_refund' where order_id = o.id and status in ('open', 'creator_responded');
end $$;

create or replace function public.admin_resolve_dispute(p_dispute_id uuid, p_refund boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.disputes;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into d from public.disputes where id = p_dispute_id;
  if not found then raise exception 'Dispute not found' using errcode = 'P0001'; end if;
  update public.disputes set admin_note = p_note where id = d.id;
  if p_refund then
    perform public.refund_order(d.order_id, coalesce(nullif(p_note, ''), 'Dispute resolved in buyer’s favour'));
  else
    update public.disputes set status = 'resolved_rejected' where id = d.id;
  end if;
end $$;

-- Buyer access page — replaces the phase-2 version
create or replace function public.get_order(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders;
  pr public.products;
  pg public.pages;
  v_paid boolean;
  v_active boolean;
  up public.products;
begin
  select * into o from public.orders where access_token = p_token;
  if not found then return null; end if;
  select * into pg from public.pages where id = o.page_id;
  select * into pr from public.products where id = o.product_id;
  v_paid := o.status = 'paid';
  v_active := v_paid and (o.access_expires_at is null or o.access_expires_at > now());
  if v_paid and pr.id is not null and o.upsell_of is null and nullif(pr.data ->> 'upsell_product_id', '') is not null
     and not exists (select 1 from public.orders where upsell_of = o.id) then
    select * into up from public.products
     where id = (pr.data ->> 'upsell_product_id')::uuid and page_id = pr.page_id and is_published and type in ('digital', 'content', 'bundle');
  end if;

  return jsonb_build_object(
    'order', jsonb_build_object('id', o.id, 'kind', o.kind, 'status', o.status, 'amount_inr', o.amount_inr,
      'discount_inr', o.discount_inr, 'buyer_name', o.buyer_name, 'buyer_email', o.buyer_email,
      'created_at', o.created_at, 'payment_ref', o.payment_ref, 'payment_provider', o.payment_provider,
      'product_title', o.product_title, 'product_type', o.product_type, 'question', o.question, 'answer', o.answer,
      'answered_at', o.answered_at, 'access_expires_at', o.access_expires_at, 'refunded_at', o.refunded_at,
      'refund_reason', o.refund_reason),
    'page', jsonb_build_object('id', pg.id, 'username', pg.username, 'display_name', pg.display_name,
      'avatar_url', pg.avatar_url, 'theme', pg.theme),
    'product', case when pr.id is null then null else public.product_public_json(pr) end,
    'access', case when v_active and pr.id is not null then jsonb_build_object(
      'meeting_url', pr.private ->> 'meeting_url',
      'instructions', pr.private ->> 'instructions',
      'content', pr.private ->> 'content',
      'invite_url', case when pr.type = 'membership' then pr.private ->> 'invite_url' end,
      'has_file', pr.file_path is not null
    ) end,
    'membership_active', case when pr.type = 'membership' then v_active end,
    'bundle_items', case when v_active and pr.type = 'bundle' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'type', b.type,
        'has_file', b.file_path is not null, 'file_name', b.file_name, 'content', b.private ->> 'content',
        'instructions', b.private ->> 'instructions')), '[]'::jsonb)
      from public.products b
      where b.page_id = pr.page_id and b.type in ('digital', 'content')
        and b.id::text in (select jsonb_array_elements_text(coalesce(pr.data -> 'items', '[]'::jsonb)))
    ) end,
    'bookings', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
                   'status', b.status, 'cancel_reason', b.cancel_reason) order by b.starts_at), '[]'::jsonb)
                 from public.bookings b where b.order_id = o.id),
    'booking', (select jsonb_build_object('starts_at', b.starts_at, 'ends_at', b.ends_at, 'status', b.status)
                from public.bookings b where b.order_id = o.id order by b.starts_at limit 1),
    'sessions_total', case when pr.type = 'session' then greatest(coalesce(nullif(pr.data ->> 'sessions', '')::int, 1), 1) end,
    'reschedule_hours', case when pr.type = 'session' then coalesce(nullif(pr.data ->> 'reschedule_hours', '')::int, 24) end,
    'session_data', case when pr.type = 'session' and v_active then pr.data end,
    'booked', case when pr.type = 'session' and v_active then (
      select coalesce(jsonb_agg(b.starts_at), '[]'::jsonb) from public.bookings b
      where b.product_id = pr.id and b.status <> 'cancelled' and b.starts_at > now()) end,
    'upsell', case when up.id is not null then public.product_public_json(up) ||
      jsonb_build_object('offer_price_inr', coalesce(nullif(pr.data ->> 'upsell_price_inr', '')::int, public.product_effective_price(up))) end,
    'dispute', (select jsonb_build_object('status', d.status, 'creator_response', d.creator_response, 'created_at', d.created_at)
                from public.disputes d where d.order_id = o.id order by d.created_at desc limit 1)
  );
end $$;

-- ---------------------------------------------------------------------
-- Members-only sub-pages
-- ---------------------------------------------------------------------
create or replace function public.page_blocks_json(p_page_id uuid, p_site_page_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'type', b.type, 'data', b.data) order by b.position, b.created_at), '[]'::jsonb)
  from public.blocks b
  where b.page_id = p_page_id and b.site_page_id is not distinct from p_site_page_id and b.is_active
    and (b.starts_at is null or b.starts_at <= now())
    and (b.ends_at is null or b.ends_at > now());
$$;

drop function public.get_public_page(text);
create or replace function public.get_public_page(p_username text, p_slug text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_page public.pages;
  v_sp public.site_pages;
  v_features jsonb;
  v_locked boolean := false;
begin
  select p.* into v_page from public.pages p join public.profiles o on o.id = p.owner_id
   where p.username = lower(p_username) and p.is_published and p.moderation_status = 'ok' and o.status = 'active';
  if not found then return null; end if;
  if nullif(p_slug, '') is not null then
    select * into v_sp from public.site_pages where page_id = v_page.id and slug = lower(p_slug) and is_published;
    if not found then return null; end if;
    v_locked := v_sp.visibility = 'members';
  end if;
  v_features := public.plan_features(v_page.owner_id);

  return jsonb_build_object(
    'page', jsonb_build_object(
      'id', v_page.id, 'username', v_page.username, 'display_name', v_page.display_name, 'bio', v_page.bio,
      'avatar_url', v_page.avatar_url, 'niche', v_page.niche, 'language', v_page.language, 'theme', v_page.theme,
      'socials', v_page.socials, 'seo', v_page.seo, 'tracking', v_page.tracking,
      'show_branding', v_page.show_branding or not coalesce((v_features ->> 'remove_branding')::boolean, false),
      'whatsapp', case when coalesce((v_page.whatsapp ->> 'open')::boolean, false) then v_page.whatsapp - 'open' end,
      'media_kit_enabled', coalesce((v_page.media_kit ->> 'enabled')::boolean, true)
    ),
    'nav', (select coalesce(jsonb_agg(jsonb_build_object('slug', s.slug, 'label', coalesce(nullif(s.nav_label, ''), s.title),
              'members', s.visibility = 'members') order by s.position, s.created_at), '[]'::jsonb)
            from public.site_pages s where s.page_id = v_page.id and s.is_published and s.show_in_nav),
    'site_page', case when v_sp.id is null then null else jsonb_build_object(
      'id', v_sp.id, 'slug', v_sp.slug, 'title', v_sp.title, 'visibility', v_sp.visibility, 'seo', v_sp.seo) end,
    'locked', v_locked,
    'blocks', case when v_locked then '[]'::jsonb else public.page_blocks_json(v_page.id, v_sp.id) end,
    'products', (select coalesce(jsonb_agg(public.product_public_json(pr) order by pr.position, pr.created_at), '[]'::jsonb)
                 from public.products pr where pr.page_id = v_page.id and pr.is_published),
    'latest_reel', (select m ->> 'permalink' from public.instagram_accounts i, jsonb_array_elements(i.recent_media) m
                    where i.owner_id = v_page.owner_id and (m ->> 'media_product_type' = 'REELS' or m ->> 'media_type' = 'VIDEO')
                    limit 1)
  );
end $$;

create or replace function public.get_member_page(p_username text, p_slug text, p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb := public.get_public_page(p_username, p_slug);
begin
  if r is null or not coalesce((r ->> 'locked')::boolean, false) then return r; end if;
  if not exists (
    select 1 from public.orders o join public.products pr on pr.id = o.product_id
    where o.access_token = p_token and o.page_id = (r -> 'page' ->> 'id')::uuid and pr.type = 'membership'
      and o.status = 'paid' and (o.access_expires_at is null or o.access_expires_at > now())
  ) then
    raise exception 'Your membership isn’t active. Renew to get access.' using errcode = 'P0001';
  end if;
  return r || jsonb_build_object('locked', false, 'member', true,
    'blocks', public.page_blocks_json((r -> 'page' ->> 'id')::uuid, (r -> 'site_page' ->> 'id')::uuid));
end $$;

-- Products on a custom domain / product page carry the page id
create or replace function public.get_public_product(p_username text, p_product_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'page', jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
      'avatar_url', p.avatar_url, 'theme', p.theme, 'language', p.language, 'tracking', p.tracking),
    'product', public.product_public_json(pr),
    'booked', case when pr.type = 'session' then coalesce((
      select jsonb_agg(b.starts_at) from public.bookings b
      where b.product_id = pr.id and b.status <> 'cancelled' and b.starts_at > now()
    ), '[]'::jsonb) else '[]'::jsonb end,
    'seats_left', case when pr.type = 'webinar' and (pr.data ->> 'capacity') ~ '^\d+$'
      then greatest(0, (pr.data ->> 'capacity')::int - (
        select count(*) from public.orders o where o.product_id = pr.id and o.status = 'paid')::int)
      else null end
  )
  from public.products pr
  join public.pages p on p.id = pr.page_id
  join public.profiles o on o.id = p.owner_id
  where p.username = lower(p_username) and pr.id = p_product_id and pr.is_published
    and p.is_published and p.moderation_status = 'ok' and o.status = 'active';
$$;

-- ---------------------------------------------------------------------
-- Fraud flags
-- ---------------------------------------------------------------------
create table public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  page_id uuid references public.pages (id) on delete cascade,
  subject_type text not null check (subject_type in ('order', 'page', 'profile')),
  subject_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index fraud_flags_status_idx on public.fraud_flags (status, created_at desc);
alter table public.fraud_flags enable row level security;
create policy "fraud: admin read" on public.fraud_flags for select to authenticated using ((select public.is_admin()));
create policy "fraud: admin update" on public.fraud_flags for update to authenticated using ((select public.is_admin()));
grant select, update on public.fraud_flags to authenticated;

create or replace function public.raise_flag(p_kind text, p_severity text, p_page uuid, p_type text, p_subject uuid, p_details jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- one open flag per kind + subject per day
  if exists (select 1 from public.fraud_flags where kind = p_kind and subject_id = p_subject and status = 'open'
             and created_at > now() - interval '1 day') then
    return;
  end if;
  insert into public.fraud_flags (kind, severity, page_id, subject_type, subject_id, details)
  values (p_kind, p_severity, p_page, p_type, p_subject, p_details);
end $$;

create or replace function public.fraud_on_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.orders where lower(buyer_email) = lower(new.buyer_email) and created_at > now() - interval '1 hour';
  if v_n >= 6 then
    perform public.raise_flag('order_velocity', 'medium', new.page_id, 'order', new.id,
      jsonb_build_object('email', new.buyer_email, 'orders_last_hour', v_n));
  end if;
  if new.amount_inr >= 50000 then
    perform public.raise_flag('high_value_order', 'low', new.page_id, 'order', new.id,
      jsonb_build_object('amount_inr', new.amount_inr, 'email', new.buyer_email));
  end if;
  select count(*) into v_n from public.orders where page_id = new.page_id and created_at > now() - interval '10 minutes';
  if v_n >= 50 then
    perform public.raise_flag('order_spike', 'high', new.page_id, 'page', new.page_id, jsonb_build_object('orders_10_min', v_n));
  end if;
  return new;
end $$;
create trigger orders_fraud after insert on public.orders for each row execute function public.fraud_on_order();

create or replace function public.fraud_on_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.reports where page_id = new.page_id and status = 'open' and created_at > now() - interval '1 day';
  if v_n >= 3 then
    perform public.raise_flag('report_spike', case when v_n >= 10 then 'high' else 'medium' end, new.page_id, 'page', new.page_id,
      jsonb_build_object('open_reports_24h', v_n));
  end if;
  return new;
end $$;
create trigger reports_fraud after insert on public.reports for each row execute function public.fraud_on_report();

create or replace function public.fraud_on_dispute()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.disputes where page_id = new.page_id and created_at > now() - interval '30 days';
  if v_n >= 3 then
    perform public.raise_flag('dispute_rate', 'high', new.page_id, 'page', new.page_id, jsonb_build_object('disputes_30d', v_n));
  end if;
  return new;
end $$;
create trigger disputes_fraud after insert on public.disputes for each row execute function public.fraud_on_dispute();

create or replace function public.fraud_on_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.leads where page_id = new.page_id and created_at > now() - interval '10 minutes';
  if v_n >= 60 then
    perform public.raise_flag('lead_flood', 'medium', new.page_id, 'page', new.page_id, jsonb_build_object('leads_10_min', v_n));
  end if;
  return new;
end $$;
create trigger leads_fraud after insert on public.leads for each row execute function public.fraud_on_lead();

-- ---------------------------------------------------------------------
-- GST invoices for brand deals
-- ---------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  number text not null,
  issue_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  due_date date,
  brand_name text not null check (char_length(brand_name) <= 160),
  brand_email text,
  brand_gstin text check (brand_gstin is null or brand_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  brand_address text,
  brand_state_code text check (brand_state_code is null or brand_state_code ~ '^[0-9]{2}$'),
  items jsonb not null default '[]'::jsonb,
  seller jsonb not null default '{}'::jsonb,
  tax_mode text not null default 'none' check (tax_mode in ('intra', 'inter', 'none')),
  gst_rate numeric(5, 2) not null default 18,
  subtotal numeric(12, 2) not null default 0,
  cgst numeric(12, 2) not null default 0,
  sgst numeric(12, 2) not null default 0,
  igst numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled')),
  paid_at timestamptz,
  notes text,
  reminders jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, number)
);
create index invoices_page_idx on public.invoices (page_id, issue_date desc);
create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();

create or replace function public.compute_invoice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_fy text;
  v_prefix text;
  v_seq integer;
  it jsonb;
  v_sub numeric := 0;
begin
  if tg_op = 'INSERT' or new.seller = '{}'::jsonb then
    new.seller := (select billing from public.pages where id = new.page_id);
  end if;
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 then
    raise exception 'Add at least one line item' using errcode = 'P0001';
  end if;
  for it in select * from jsonb_array_elements(new.items) loop
    if coalesce(trim(it ->> 'description'), '') = '' or coalesce((it ->> 'qty')::numeric, 0) <= 0
       or coalesce((it ->> 'rate')::numeric, -1) < 0 then
      raise exception 'Each line needs a description, quantity and rate' using errcode = 'P0001';
    end if;
    v_sub := v_sub + round((it ->> 'qty')::numeric * (it ->> 'rate')::numeric, 2);
  end loop;
  new.subtotal := v_sub;
  new.gst_rate := coalesce(nullif(new.seller ->> 'gst_rate', '')::numeric, 18);

  if coalesce(new.seller ->> 'gstin', '') = '' then
    new.tax_mode := 'none';
  elsif new.brand_state_code is not null and new.brand_state_code = left(new.seller ->> 'gstin', 2) then
    new.tax_mode := 'intra';
  else
    new.tax_mode := 'inter';
  end if;
  new.cgst := case when new.tax_mode = 'intra' then round(v_sub * new.gst_rate / 200, 2) else 0 end;
  new.sgst := new.cgst;
  new.igst := case when new.tax_mode = 'inter' then round(v_sub * new.gst_rate / 100, 2) else 0 end;
  new.total := new.subtotal + new.cgst + new.sgst + new.igst;

  if tg_op = 'INSERT' and coalesce(new.number, '') = '' then
    v_fy := case when extract(month from new.issue_date) >= 4
                 then extract(year from new.issue_date)::int || '-' || lpad(((extract(year from new.issue_date)::int + 1) % 100)::text, 2, '0')
                 else (extract(year from new.issue_date)::int - 1) || '-' || lpad((extract(year from new.issue_date)::int % 100)::text, 2, '0') end;
    v_prefix := coalesce(nullif(upper(regexp_replace(new.seller ->> 'invoice_prefix', '[^A-Za-z0-9-]', '', 'g')), ''), 'INV') || '/' || v_fy || '/';
    select coalesce(max(substring(number from length(v_prefix) + 1)::int), 0) + 1 into v_seq
      from public.invoices where page_id = new.page_id and number like v_prefix || '%' and substring(number from length(v_prefix) + 1) ~ '^\d+$';
    new.number := v_prefix || lpad(v_seq::text, 4, '0');
  end if;

  if new.status = 'paid' and new.paid_at is null then new.paid_at := now(); end if;
  if new.status <> 'paid' then new.paid_at := null; end if;
  return new;
end $$;
create trigger invoices_compute before insert or update on public.invoices for each row execute function public.compute_invoice();

create or replace function public.invoice_paid_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paid' and old.status <> 'paid' and new.enquiry_id is not null then
    update public.enquiries set stage = 'paid', amount_inr = coalesce(amount_inr, round(new.total)::int) where id = new.enquiry_id;
  end if;
  return new;
end $$;
create trigger invoices_paid_sync after update on public.invoices for each row execute function public.invoice_paid_sync();

alter table public.invoices enable row level security;
create policy "invoices: team read" on public.invoices for select to authenticated using ((select public.can_view_page(page_id)));
create policy "invoices: team write" on public.invoices for insert to authenticated with check ((select public.can_edit_page(page_id)));
create policy "invoices: team update" on public.invoices for update to authenticated using ((select public.can_edit_page(page_id)));
create policy "invoices: team delete" on public.invoices for delete to authenticated using ((select public.can_edit_page(page_id)) and status = 'draft');
grant select, insert, update, delete on public.invoices to authenticated;

-- ---------------------------------------------------------------------
-- Audience: unified contacts (leads + buyers + brands) and saved segments
-- ---------------------------------------------------------------------
create table public.segments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  filter jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.segments enable row level security;
create policy "segments: team read" on public.segments for select to authenticated using ((select public.can_view_page(page_id)));
create policy "segments: team write" on public.segments for all to authenticated
  using ((select public.can_edit_page(page_id))) with check ((select public.can_edit_page(page_id)));
grant select, insert, update, delete on public.segments to authenticated;

create or replace function public.audience(p_page_id uuid, p_filter jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  r jsonb;
begin
  if not public.can_view_page(p_page_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  with raw as (
    select lower(email) as email, phone, name, tags, 'lead' as source, null::uuid as product_id, 0 as spent, created_at
      from public.leads where page_id = p_page_id
    union all
    select lower(buyer_email), buyer_phone, buyer_name, '{}'::text[], case when kind = 'tip' then 'tipper' else 'buyer' end,
           product_id, amount_inr, created_at
      from public.orders where page_id = p_page_id and status = 'paid'
    union all
    select lower(email), phone, coalesce(contact_name, brand_name), '{}'::text[], 'brand', null, 0, created_at
      from public.enquiries where page_id = p_page_id
  ),
  people as (
    select coalesce(email, phone) as key,
           max(email) as email, max(phone) as phone, max(name) as name,
           array(select distinct x from unnest(string_to_array(string_agg(nullif(array_to_string(tags, ','), ''), ','), ',')) x where x <> '') as tags,
           array_agg(distinct source) as sources,
           array_remove(array_agg(distinct product_id), null) as products,
           sum(spent)::int as total_spent,
           count(*) filter (where source in ('buyer', 'tipper'))::int as orders,
           min(created_at) as first_seen, max(created_at) as last_seen
    from raw where coalesce(email, phone) is not null
    group by coalesce(email, phone)
  )
  select coalesce(jsonb_agg(to_jsonb(people) - 'key' order by last_seen desc), '[]'::jsonb) into r
  from people
  where (nullif(f ->> 'source', '') is null or f ->> 'source' = any(sources))
    and (nullif(f ->> 'tag', '') is null or f ->> 'tag' = any(tags))
    and (nullif(f ->> 'product_id', '') is null or (f ->> 'product_id')::uuid = any(products))
    and (nullif(f ->> 'min_spent', '') is null or total_spent >= (f ->> 'min_spent')::int)
    and (not coalesce((f ->> 'has_email')::boolean, false) or email is not null)
    and (not coalesce((f ->> 'has_phone')::boolean, false) or phone is not null)
    and (nullif(f ->> 'since', '') is null or last_seen >= (f ->> 'since')::date)
    and (nullif(f ->> 'q', '') is null or coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(name, '') ilike '%' || (f ->> 'q') || '%');
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Analytics: UTM medium/campaign, geo, product views, abuse limits
-- ---------------------------------------------------------------------
alter table public.events
  add column medium text,
  add column campaign text,
  add column region text,
  add column city text;
alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check check (type in ('view', 'click', 'product_view'));
create index events_visitor_idx on public.events (page_id, visitor_id, created_at) where visitor_id is not null;

alter table public.page_daily
  add column product_views integer not null default 0,
  add column mediums jsonb not null default '{}'::jsonb,
  add column campaigns jsonb not null default '{}'::jsonb,
  add column regions jsonb not null default '{}'::jsonb,
  add column cities jsonb not null default '{}'::jsonb;

create table public.product_daily (
  product_id uuid not null references public.products (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  day date not null,
  views integer not null default 0,
  primary key (product_id, day)
);
create index product_daily_page_idx on public.product_daily (page_id, day);
alter table public.product_daily enable row level security;
create policy "product_daily: team read" on public.product_daily for select to authenticated
  using ((select public.can_view_page(page_id)) or (select public.is_admin()));
grant select on public.product_daily to authenticated;

drop function public.track_event(uuid, text, uuid, text, text, text, text, text);
create or replace function public.track_event(
  p_page_id uuid, p_type text, p_block_id uuid default null, p_visitor text default null,
  p_source text default null, p_device text default null, p_browser text default null, p_os text default null,
  p_medium text default null, p_campaign text default null, p_region text default null, p_city text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_type not in ('view', 'click', 'product_view') then return; end if;
  if not exists (select 1 from public.pages where id = p_page_id and is_published) then return; end if;
  -- Abuse limits: one view per visitor per 30 min; at most 100 clicks per visitor per hour
  if p_visitor is not null then
    if p_type <> 'click' and exists (
      select 1 from public.events
      where page_id = p_page_id and visitor_id = left(p_visitor, 64) and type = p_type
        and block_id is not distinct from p_block_id and created_at > now() - interval '30 minutes'
    ) then
      return;
    end if;
    if p_type = 'click' and (
      select count(*) from public.events
      where page_id = p_page_id and visitor_id = left(p_visitor, 64) and type = 'click' and created_at > now() - interval '1 hour'
    ) >= 100 then
      return;
    end if;
  end if;
  insert into public.events (page_id, block_id, type, visitor_id, source, device, browser, os, medium, campaign, region, city)
  values (p_page_id, p_block_id, p_type, left(p_visitor, 64), left(lower(p_source), 32), left(lower(p_device), 16),
          left(lower(p_browser), 24), left(lower(p_os), 16), left(lower(p_medium), 32), left(lower(p_campaign), 64),
          left(p_region, 64), left(p_city, 64));
end $$;

create or replace function public.rollup_events(p_day date, p_page_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_from timestamptz := (p_day::timestamp at time zone 'Asia/Kolkata');
  v_to   timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Kolkata');
begin
  insert into public.page_daily (page_id, day, views, uniques, clicks, product_views, sources, devices, browsers,
                                 mediums, campaigns, regions, cities)
  with ev as (
    select e.* from public.events e
    join public.pages p on p.id = e.page_id
    where e.created_at >= v_from and e.created_at < v_to
      and (p_page_id is null or e.page_id = p_page_id)
  ),
  base as (
    select page_id,
           count(*) filter (where type = 'view') as views,
           count(distinct visitor_id) filter (where type = 'view') as uniques,
           count(*) filter (where type = 'click') as clicks,
           count(*) filter (where type = 'product_view') as product_views
    from ev group by page_id
  ),
  agg as (
    select page_id, dim, jsonb_object_agg(k, n) as j from (
      select page_id, 'source' as dim, coalesce(source, 'direct') as k, count(*) as n from ev where type = 'view' group by 1, 3
      union all select page_id, 'device', coalesce(device, 'unknown'), count(*) from ev where type = 'view' group by 1, 3
      union all select page_id, 'browser', coalesce(browser, 'other'), count(*) from ev where type = 'view' group by 1, 3
      union all select page_id, 'medium', medium, count(*) from ev where type = 'view' and medium is not null group by 1, 3
      union all select page_id, 'campaign', campaign, count(*) from ev where type = 'view' and campaign is not null group by 1, 3
      union all select page_id, 'region', region, count(*) from ev where type = 'view' and region is not null group by 1, 3
      union all select page_id, 'city', city, count(*) from ev where type = 'view' and city is not null group by 1, 3
    ) t group by page_id, dim
  )
  select b.page_id, p_day, b.views, b.uniques, b.clicks, b.product_views,
         coalesce((select j from agg where agg.page_id = b.page_id and dim = 'source'), '{}'),
         coalesce((select j from agg where agg.page_id = b.page_id and dim = 'device'), '{}'),
         coalesce((select j from agg where agg.page_id = b.page_id and dim = 'browser'), '{}'),
         coalesce((select j from agg where agg.page_id = b.page_id and dim = 'medium'), '{}'),
         coalesce((select j from agg where agg.page_id = b.page_id and dim = 'campaign'), '{}'),
         coalesce((select j from agg where agg.page_id = b.page_id and dim = 'region'), '{}'),
         coalesce((select j from agg where agg.page_id = b.page_id and dim = 'city'), '{}')
  from base b
  on conflict (page_id, day) do update set
    views = excluded.views, uniques = excluded.uniques, clicks = excluded.clicks, product_views = excluded.product_views,
    sources = excluded.sources, devices = excluded.devices, browsers = excluded.browsers,
    mediums = excluded.mediums, campaigns = excluded.campaigns, regions = excluded.regions, cities = excluded.cities;

  insert into public.block_daily (block_id, page_id, day, clicks)
  select e.block_id, e.page_id, p_day, count(*)
  from public.events e
  join public.blocks bl on bl.id = e.block_id
  where e.type = 'click' and e.created_at >= v_from and e.created_at < v_to
    and (p_page_id is null or e.page_id = p_page_id)
  group by e.block_id, e.page_id
  on conflict (block_id, day) do update set clicks = excluded.clicks;

  insert into public.product_daily (product_id, page_id, day, views)
  select e.block_id, e.page_id, p_day, count(*)
  from public.events e
  join public.products pr on pr.id = e.block_id
  where e.type = 'product_view' and e.created_at >= v_from and e.created_at < v_to
    and (p_page_id is null or e.page_id = p_page_id)
  group by e.block_id, e.page_id
  on conflict (product_id, day) do update set views = excluded.views;
end $$;

drop function public.refresh_my_stats();
create or replace function public.refresh_my_stats(p_page_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_page uuid;
begin
  for v_page in
    select id from public.pages p
    where (p_page_id is null and p.owner_id = auth.uid()) or (p.id = p_page_id and public.can_view_page(p.id))
  loop
    perform public.rollup_events(v_today, v_page);
    perform public.rollup_events(v_today - 1, v_page);
  end loop;
end $$;

-- Lifetime totals for milestone cards
create or replace function public.page_milestones(p_page_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_view_page(p_page_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'views', (select coalesce(sum(views), 0) from public.page_daily where page_id = p_page_id),
    'clicks', (select coalesce(sum(clicks), 0) from public.page_daily where page_id = p_page_id),
    'leads', (select count(*) from public.leads where page_id = p_page_id),
    'earnings', (select coalesce(sum(amount_inr), 0) from public.orders where page_id = p_page_id and status = 'paid'),
    'orders', (select count(*) from public.orders where page_id = p_page_id and status = 'paid'),
    'followers', (select i.followers_count from public.instagram_accounts i join public.pages p on p.owner_id = i.owner_id where p.id = p_page_id)
  );
end $$;

-- ---------------------------------------------------------------------
-- DM automation: follow-to-unlock, lead collection, follow-ups
-- ---------------------------------------------------------------------
alter table public.dm_rules
  add column page_id uuid references public.pages (id) on delete set null,
  add column require_follow boolean not null default false,
  add column follow_prompt text check (char_length(follow_prompt) <= 500),
  add column collect text check (collect in ('email', 'phone')),
  add column collect_prompt text check (char_length(collect_prompt) <= 300),
  add column collect_thanks text check (char_length(collect_thanks) <= 300),
  add column follow_up_message text check (char_length(follow_up_message) <= 1000),
  add column follow_up_minutes integer check (follow_up_minutes between 5 and 1380);

alter table public.dm_events
  add column awaiting text check (awaiting in ('follow', 'collect')),
  add column follow_up_at timestamptz,
  add column follow_up_sent boolean not null default false,
  add column window_until timestamptz;
create index dm_events_awaiting_idx on public.dm_events (owner_id, ig_user_id, created_at desc) where awaiting is not null;
create index dm_events_followup_idx on public.dm_events (follow_up_at) where follow_up_at is not null and not follow_up_sent;

-- ---------------------------------------------------------------------
-- Admin stats
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'creators', (select count(*) from public.profiles where role = 'creator'),
    'signups_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'pages', (select count(*) from public.pages),
    'published', (select count(*) from public.pages where is_published),
    'suspended', (select count(*) from public.profiles where status = 'suspended'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'instagram_connected', (select count(*) from public.instagram_accounts),
    'leads_7d', (select count(*) from public.leads where created_at > now() - interval '7 days'),
    'views_7d', (select coalesce(sum(views), 0) from public.page_daily where day > current_date - 7),
    'clicks_7d', (select coalesce(sum(clicks), 0) from public.page_daily where day > current_date - 7),
    'gmv_30d', (select coalesce(sum(amount_inr), 0) from public.orders where status = 'paid' and created_at > now() - interval '30 days'),
    'orders_30d', (select count(*) from public.orders where status = 'paid' and created_at > now() - interval '30 days'),
    'products', (select count(*) from public.products where is_published),
    'unread_messages', (select count(*) from public.support_messages where sender = 'creator' and read_at is null),
    'open_flags', (select count(*) from public.fraud_flags where status = 'open'),
    'open_disputes', (select count(*) from public.disputes where status in ('open', 'creator_responded')),
    'paid_creators', (select count(*) from public.profiles where plan <> 'free' and (plan_expires_at is null or plan_expires_at > now())),
    'pending_domains', (select count(*) from public.pages where domain_status = 'verified'),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'signups', s, 'views', v) order by d), '[]')
      from (
        select g::date as d,
          (select count(*) from public.profiles where created_at::date = g::date) as s,
          (select coalesce(sum(views), 0) from public.page_daily where day = g::date) as v
        from generate_series(current_date - 29, current_date, interval '1 day') g
      ) t
    )
  );
end $$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on public.disputes, public.fraud_flags, public.invoices, public.segments, public.product_daily from anon;
revoke execute on function public.raise_flag(text, text, uuid, text, uuid, jsonb), public.fraud_on_order(), public.fraud_on_report(),
  public.fraud_on_dispute(), public.fraud_on_lead(), public.compute_invoice(), public.invoice_paid_sync()
  from public, anon, authenticated;
grant execute on function
  public.get_public_page(text, text), public.get_member_page(text, text, text), public.get_public_product(text, uuid),
  public.get_order(text), public.create_test_order(uuid, text, text, text, integer, text, timestamptz, text),
  public.book_session(text, timestamptz), public.reschedule_booking(text, uuid, timestamptz), public.accept_upsell(text),
  public.open_dispute(text, text, text),
  public.track_event(uuid, text, uuid, text, text, text, text, text, text, text, text, text)
  to anon, authenticated;
grant execute on function public.answer_question(uuid, text), public.respond_dispute(uuid, text), public.refund_order(uuid, text),
  public.admin_resolve_dispute(uuid, boolean, text), public.audience(uuid, jsonb), public.refresh_my_stats(uuid),
  public.page_milestones(uuid) to authenticated;
