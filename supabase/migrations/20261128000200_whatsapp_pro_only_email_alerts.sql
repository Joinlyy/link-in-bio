-- WhatsApp alerts are a Pro feature only. Every plan gets the same alerts by email.
update public.plans set features = jsonb_set(features, '{whatsapp}', 'false'::jsonb), updated_at = now() where id in ('free', 'pro');
update public.plans set features = jsonb_set(features, '{whatsapp}', 'true'::jsonb), updated_at = now() where id = 'business';

create or replace function public.leads_email_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_email('lead', new.id::text);
  return null;
end $$;
drop trigger if exists leads_email_notify on public.leads;
create trigger leads_email_notify after insert on public.leads for each row execute function public.leads_email_notify();

create or replace function public.enquiries_email_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.stage = 'enquiry' then perform public.notify_email('enquiry', new.id::text); end if;
  return null;
end $$;
drop trigger if exists enquiries_email_notify on public.enquiries;
create trigger enquiries_email_notify after insert on public.enquiries for each row execute function public.enquiries_email_notify();

create or replace function public.ig_posts_email_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('published', 'failed') and new.status is distinct from old.status then
    perform public.notify_email('post', new.id::text);
  end if;
  return null;
end $$;
drop trigger if exists ig_posts_email_notify on public.ig_scheduled_posts;
create trigger ig_posts_email_notify after update on public.ig_scheduled_posts for each row execute function public.ig_posts_email_notify();
