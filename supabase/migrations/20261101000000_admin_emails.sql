-- Emails that become super admin as soon as their address is confirmed
-- (Google sign-ins are confirmed immediately; unconfirmed sign-ups never qualify).
create table public.admin_emails (
  email text primary key check (email = lower(email))
);
alter table public.admin_emails enable row level security; -- no policies: SQL editor / service role only
revoke all on public.admin_emails from anon, authenticated;

create or replace function public.promote_admin_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_emails where email = lower(new.email)) then
    update public.profiles set role = 'admin' where id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.promote_admin_email() from public, anon, authenticated;

-- Named to fire after on_auth_user_created, which inserts the profile
create trigger on_auth_user_promote after insert or update of email_confirmed_at on auth.users
  for each row execute function public.promote_admin_email();
