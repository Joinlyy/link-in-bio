-- Super admin signs in with email and password (or Google) only: the authenticator code is no longer required.
-- Every admin function still checks that the caller is an active admin.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;
