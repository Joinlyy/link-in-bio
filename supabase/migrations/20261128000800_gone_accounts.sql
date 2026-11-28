-- When a creator deletes their account, all their data goes. Only the money totals stay, under the name "Gone_<name>",
-- so the admin revenue, commission and order numbers do not shrink and deleted accounts can still be tracked.
-- No email, phone, UPI or other personal data is kept.
create table if not exists public.gone_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text,
  plan text,
  signed_up_at timestamptz,
  deleted_at timestamptz not null default now(),
  orders integer not null default 0,
  gross_inr numeric(12, 2) not null default 0,
  commission_inr numeric(12, 2) not null default 0,
  share_inr numeric(12, 2) not null default 0,
  paid_out_inr numeric(12, 2) not null default 0,
  balance_inr numeric(12, 2) not null default 0
);
alter table public.gone_accounts enable row level security;
revoke all on public.gone_accounts from anon, authenticated;
drop policy if exists "gone_accounts: admin read" on public.gone_accounts;
create policy "gone_accounts: admin read" on public.gone_accounts for select to authenticated using ((select public.is_admin()));
grant select on public.gone_accounts to authenticated;

-- Called by the account function just before the account is deleted
create or replace function public.snapshot_gone_account(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  e jsonb := public.creator_earnings(p_user);
  v_name text;
  v_user text;
  v_plan text;
  v_since timestamptz;
begin
  select coalesce(nullif(btrim(pr.full_name), ''), split_part(pr.email, '@', 1), 'creator'), pr.plan, pr.created_at
    into v_name, v_plan, v_since from public.profiles pr where pr.id = p_user;
  select pg.username into v_user from public.pages pg where pg.owner_id = p_user limit 1;
  insert into public.gone_accounts (name, username, plan, signed_up_at, orders, gross_inr, commission_inr, share_inr, paid_out_inr, balance_inr)
  values ('Gone_' || coalesce(v_name, 'creator'), case when v_user is null then null else 'Gone_' || v_user end, v_plan, v_since,
    (select count(*) from public.orders o join public.pages p on p.id = o.page_id where p.owner_id = p_user and o.status = 'paid'),
    (select coalesce(sum(o.amount_inr), 0) from public.orders o join public.pages p on p.id = o.page_id where p.owner_id = p_user and o.status = 'paid'),
    (e ->> 'commission')::numeric, (e ->> 'share')::numeric, (e ->> 'paid_out')::numeric, (e ->> 'balance')::numeric);
end $$;
revoke execute on function public.snapshot_gone_account(uuid) from public, anon, authenticated;
grant execute on function public.snapshot_gone_account(uuid) to service_role;

-- Admin list of deleted accounts
create or replace function public.admin_gone_accounts()
returns setof public.gone_accounts language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query select * from public.gone_accounts order by deleted_at desc;
end $$;
revoke execute on function public.admin_gone_accounts() from public, anon;
grant execute on function public.admin_gone_accounts() to authenticated;

-- Keep deleted accounts in the all-time admin totals
do $$
declare
  d text;
begin
  select pg_get_functiondef('public.admin_money()'::regprocedure) into d;
  d := replace(d, '''gmv_total'', (select coalesce(sum(amount_inr), 0) from public.orders where status = ''paid''),',
    '''gmv_total'', (select coalesce(sum(amount_inr), 0) from public.orders where status = ''paid'') + (select coalesce(sum(gross_inr), 0) from public.gone_accounts),');
  d := replace(d, '''orders_total'', (select count(*) from public.orders where status = ''paid''),',
    '''orders_total'', (select count(*) from public.orders where status = ''paid'') + (select coalesce(sum(orders), 0) from public.gone_accounts),');
  d := replace(d, '''commission'', (select coalesce(round(sum(commission_inr)), 0) from public.orders where status = ''paid'' and payment_provider = ''razorpay''),',
    '''commission'', (select coalesce(round(sum(commission_inr)), 0) from public.orders where status = ''paid'' and payment_provider = ''razorpay'') + (select coalesce(round(sum(commission_inr)), 0) from public.gone_accounts),');
  if d not like '%gone_accounts%gone_accounts%gone_accounts%' then raise exception 'admin_money was not changed'; end if;
  execute d;

  select pg_get_functiondef('public.admin_stats()'::regprocedure) into d;
  d := replace(d, '''gmv_total'', (select coalesce(sum(amount_inr), 0) from public.orders where status = ''paid''),',
    '''gmv_total'', (select coalesce(sum(amount_inr), 0) from public.orders where status = ''paid'') + (select coalesce(sum(gross_inr), 0) from public.gone_accounts),');
  d := replace(d, '''orders_total'', (select count(*) from public.orders where status = ''paid''),',
    '''orders_total'', (select count(*) from public.orders where status = ''paid'') + (select coalesce(sum(orders), 0) from public.gone_accounts),' || chr(10) || '    ''gone_accounts'', (select count(*) from public.gone_accounts),');
  if d not like '%gone_accounts%gone_accounts%' then raise exception 'admin_stats was not changed'; end if;
  execute d;
end $$;
