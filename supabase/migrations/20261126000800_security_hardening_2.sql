-- Security hardening found in the 2026-11-26 review.

-- 1. Functions that only signed-in users (or the server) need were still callable by anyone because PUBLIC has execute by default.
revoke execute on function public.my_earnings() from public, anon;
revoke execute on function public.my_payout_status() from public, anon;
revoke execute on function public.schedule_ig_post(text, text, text, text, timestamptz) from public, anon;
revoke execute on function public.cancel_ig_post(uuid) from public, anon;
revoke execute on function public.retry_ig_post(uuid) from public, anon;
revoke execute on function public.admin_creator_earnings() from public, anon;
revoke execute on function public.admin_record_payout(uuid, numeric, text, text) from public, anon;
revoke execute on function public.admin_sales_ledger(integer) from public, anon;
revoke execute on function public.admin_set_route(boolean) from public, anon;
revoke execute on function public.products_require_kyc() from public, anon, authenticated;
-- creator_can_sell(uuid) answered "can this user sell?" for anyone's id; only the database itself needs it
revoke execute on function public.creator_can_sell(uuid) from public, anon, authenticated;

-- 2. The email function trusted any caller. Database triggers and cron now send the shared secret from the vault.
create or replace function public.notify_email(p_kind text, p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/email',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')),
    body := jsonb_build_object('action', 'event', 'kind', p_kind, 'id', p_id),
    timeout_milliseconds := 20000
  );
exception when others then
  null;
end $$;
revoke execute on function public.notify_email(text, text) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'email-reminders';
select cron.schedule('email-reminders', '30 3 * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secret),
    body := jsonb_build_object('action', 'reminders'),
    timeout_milliseconds := 60000
  )
  from (select (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret) s
  where coalesce(s.secret, '') <> ''
$job$);

-- 3. Uploads for scheduled posts count against the same storage quota as other uploads
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
    from storage.objects where bucket_id in ('creator-images', 'product-files', 'ig-posts') and name like p_folder || '/%';
  return v_used < v_quota;
end $$;
revoke execute on function public.storage_has_room(text) from public, anon;
grant execute on function public.storage_has_room(text) to authenticated;

drop policy if exists "uploads: within storage quota" on storage.objects;
create policy "uploads: within storage quota" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('creator-images', 'product-files', 'ig-posts') or public.storage_has_room((storage.foldername(name))[1]));

-- 4. Files uploaded for a post that was never scheduled (or already handled) are removed after 2 days by the instagram function
create or replace function public.ig_orphan_media()
returns table (name text) language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'ig-posts' and o.created_at < now() - interval '2 days'
    and not exists (select 1 from public.ig_scheduled_posts p where p.media_path = o.name and p.status in ('scheduled', 'publishing'))
  limit 200;
$$;
revoke execute on function public.ig_orphan_media() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'instagram-purge-media';
select cron.schedule('instagram-purge-media', '15 4 * * *', $job$
  select net.http_post(
    url := 'https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secret),
    body := jsonb_build_object('action', 'purge_media'),
    timeout_milliseconds := 60000
  )
  from (select (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret) s
  where coalesce(s.secret, '') <> ''
$job$);
