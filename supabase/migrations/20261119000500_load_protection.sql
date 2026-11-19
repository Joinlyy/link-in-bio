-- Load protection: stops floods of rows from taking the database down.
--   1. Page tracking: per-page and site-wide caps per minute (the visitor id is chosen by the browser, so it can't be trusted)
--   2. Sections per page: hard cap
--   3. Storage per creator: quota by plan
--   4. Site-wide caps per minute on orders, leads, enquiries, support requests and reports
--   5. Old logs are cleaned up on a schedule

-- ---------------------------------------------------------------------------
-- A cheap per-minute counter other functions use
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  bucket timestamptz not null,
  n integer not null default 0,
  primary key (key, bucket)
);
alter table public.rate_limits enable row level security; -- no policies: only the functions below touch it
revoke all on public.rate_limits from anon, authenticated;

/** Counts one hit for this key in the current minute. False once the limit for that minute is passed. */
create or replace function public.rate_hit(p_key text, p_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v integer;
begin
  insert into public.rate_limits (key, bucket, n) values (p_key, date_trunc('minute', now()), 1)
  on conflict (key, bucket) do update set n = public.rate_limits.n + 1
  returning n into v;
  return v <= p_limit;
end $$;
revoke execute on function public.rate_hit(text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Page tracking
--    A page takes at most 1,200 tracked events a minute; the whole site at most about 20,000.
--    Past that, events are dropped (counts dip during a flood, the database stays up).
-- ---------------------------------------------------------------------------
create or replace function public.track_event(p_page_id uuid, p_type text, p_block_id uuid default null, p_visitor text default null, p_source text default null,
  p_device text default null, p_browser text default null, p_os text default null, p_medium text default null, p_campaign text default null,
  p_region text default null, p_city text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_type not in ('view', 'click', 'product_view') then return; end if;
  if not exists (select 1 from public.pages where id = p_page_id and is_published) then return; end if;
  -- Caps first: cheap, and they hold even when the visitor id is missing or randomised
  if not public.rate_hit('ev:' || p_page_id::text, 1200) then return; end if;
  if not public.rate_hit('ev:all:' || floor(random() * 8)::text, 2500) then return; end if; -- 8 shards x 2,500
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

-- ---------------------------------------------------------------------------
-- 2. At most 150 sections on one page (templates use about 10)
-- ---------------------------------------------------------------------------
create or replace function public.cap_blocks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.blocks where page_id = new.page_id) >= 150 then
    raise exception 'A page can have at most 150 sections. Remove some before adding more.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger blocks_cap before insert on public.blocks for each row execute function public.cap_blocks();

-- ---------------------------------------------------------------------------
-- 3. Storage per creator: 250 MB on Starter, 2 GB on Creator, 10 GB on Pro (images and product files together).
--    Checked before each upload; one file can finish just past the limit, the next is refused.
-- ---------------------------------------------------------------------------
create or replace function public.storage_has_room(p_folder text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_plan text;
  v_quota bigint;
  v_used bigint;
begin
  begin
    v_owner := p_folder::uuid;
  exception when others then
    return false;
  end;
  select case when plan <> 'free' and (plan_expires_at is null or plan_expires_at > now()) then plan else 'free' end into v_plan
    from public.profiles where id = v_owner;
  if v_plan is null then return false; end if;
  v_quota := case v_plan when 'business' then 10737418240 when 'pro' then 2147483648 else 262144000 end;
  select coalesce(sum((metadata ->> 'size')::bigint), 0) into v_used
    from storage.objects where bucket_id in ('creator-images', 'product-files') and name like p_folder || '/%';
  return v_used < v_quota;
end $$;
revoke execute on function public.storage_has_room(text) from public, anon;
grant execute on function public.storage_has_room(text) to authenticated;

-- Restrictive: applies on top of the existing upload rules
create policy "uploads: within storage quota" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('creator-images', 'product-files') or public.storage_has_room((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- 4. Site-wide caps per minute on things the public can create
-- ---------------------------------------------------------------------------
create or replace function public.global_throttle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.rate_hit(tg_argv[0], tg_argv[1]::integer) then
    raise exception 'We are very busy right now. Please try again in a minute.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger orders_throttle before insert on public.orders for each row execute function public.global_throttle('orders:all', '600');
create trigger leads_throttle before insert on public.leads for each row execute function public.global_throttle('leads:all', '1500');
create trigger enquiries_throttle before insert on public.enquiries for each row execute function public.global_throttle('enquiries:all', '600');
create trigger reports_throttle before insert on public.reports for each row execute function public.global_throttle('reports:all', '300');
create trigger tickets_throttle before insert on public.support_tickets for each row execute function public.global_throttle('tickets:all', '300');

-- ---------------------------------------------------------------------------
-- 5. Clean-up jobs. The audit log is never deleted.
-- ---------------------------------------------------------------------------
select cron.schedule('purge-rate-limits', '17 * * * *', $$delete from public.rate_limits where bucket < now() - interval '2 hours'$$);
select cron.schedule('purge-old-logs', '23 3 * * *', $$
  delete from cron.job_run_details where end_time < now() - interval '14 days';
  delete from public.dm_events where created_at < now() - interval '180 days';
  delete from public.notifications where created_at < now() - interval '180 days'
$$);
