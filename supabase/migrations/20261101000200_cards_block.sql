-- Cards: a website section the creator names, with cards per row, a card style and per-card actions
alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check check (type in (
  'link', 'whatsapp', 'youtube', 'instagram', 'spotify', 'text', 'heading', 'divider', 'image',
  'webinar', 'lead_form', 'countdown', 'faq', 'testimonials', 'enquiry', 'products', 'tip',
  'locked', 'latest_reel', 'cards'
));

-- Every link inside a block is checked, including the links on individual cards
create or replace function public.validate_block()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
begin
  if pg_column_size(new.data) > 32768 then
    raise exception 'Block content is too large' using errcode = 'P0001';
  end if;
  for v_url in
    select nullif(trim(new.data ->> 'url'), '')
    union all
    select nullif(trim(item ->> 'url'), '')
    from jsonb_array_elements(case when jsonb_typeof(new.data -> 'items') = 'array' then new.data -> 'items' else '[]'::jsonb end) item
  loop
    continue when v_url is null;
    if v_url !~* '^https?://[^\s]+$' then
      raise exception 'Links must start with http:// or https://' using errcode = 'P0001';
    end if;
    if public.is_url_blocked(v_url) then
      raise exception 'This link has been blocked for safety reasons' using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;
