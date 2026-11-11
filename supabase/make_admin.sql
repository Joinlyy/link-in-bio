-- Run in Supabase Dashboard → SQL Editor to add a super admin.
-- Works before or after that person's first sign-in.
insert into public.admin_emails (email) values (lower('your-admin-email@example.com')) on conflict do nothing;
update public.profiles p set role = 'admin'
  from auth.users u
 where u.id = p.id and u.email_confirmed_at is not null and lower(u.email) = lower('your-admin-email@example.com');
