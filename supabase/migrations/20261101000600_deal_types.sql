-- Brand deals can be paid, barter, both, or affiliate. Barter deals finish at Product received.
alter table public.enquiries
  add column deal_type text not null default 'paid' check (deal_type in ('paid', 'barter', 'hybrid', 'affiliate')),
  add column product_details text check (char_length(product_details) <= 300),
  add column product_value_inr integer check (product_value_inr >= 0);

alter table public.enquiries drop constraint enquiries_stage_check;
alter table public.enquiries add constraint enquiries_stage_check
  check (stage in ('enquiry', 'negotiation', 'confirmed', 'delivered', 'paid', 'product_received', 'lost'));

-- Brands say what they're offering when they send an enquiry
drop function public.submit_enquiry(uuid, text, text, text, text, text, text);
create function public.submit_enquiry(
  p_page_id uuid, p_brand text, p_name text, p_email text, p_phone text, p_budget text, p_message text,
  p_deal_type text default 'paid'
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  if coalesce(trim(p_brand), '') = '' then raise exception 'Brand name is required' using errcode = 'P0001'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.pages where id = p_page_id and is_published and moderation_status = 'ok') then
    raise exception 'Page not found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.enquiries where page_id = p_page_id and email = v_email
       and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'You have already sent an enquiry. The creator will get back to you.' using errcode = 'P0001';
  end if;
  insert into public.enquiries (page_id, brand_name, contact_name, email, phone, budget, message, deal_type)
  values (p_page_id, left(trim(p_brand), 120), left(nullif(trim(p_name), ''), 120), v_email,
          left(nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), 20),
          left(nullif(trim(p_budget), ''), 60), left(p_message, 2000),
          case when p_deal_type in ('paid', 'barter', 'hybrid', 'affiliate') then p_deal_type else 'paid' end);
end $$;
grant execute on function public.submit_enquiry(uuid, text, text, text, text, text, text, text) to anon, authenticated;
