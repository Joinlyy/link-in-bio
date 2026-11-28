-- WhatsApp alert when a scheduled Instagram post is published or fails (utility template creator_post_status).
-- Old UPI and buyer templates are no longer used.
alter table public.notifications drop constraint if exists notifications_recipient_check;
alter table public.notifications add constraint notifications_recipient_check check (recipient in ('creator', 'buyer', 'test'));

create or replace function public.ig_posts_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('published', 'failed') and new.status is distinct from old.status then
    perform public.notify_whatsapp('post', new.id);
  end if;
  return null;
end $$;
drop trigger if exists ig_posts_notify on public.ig_scheduled_posts;
create trigger ig_posts_notify after update on public.ig_scheduled_posts for each row execute function public.ig_posts_notify();
