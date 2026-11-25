-- Admin money: our commission is now the real platform charge stored on each paid Razorpay order, not an estimate.
do $$
declare
  d text;
begin
  select pg_get_functiondef('public.admin_money()'::regprocedure) into d;
  d := regexp_replace(
    d,
    '''commission'', \(select.*?(?=''plan_revenue_30d'')',
    '''commission'', (select coalesce(round(sum(commission_inr)), 0) from public.orders where status = ''paid'' and payment_provider = ''razorpay''),' || chr(10) || '    '
  );
  if d not like '%sum(commission_inr)%' then raise exception 'admin_money was not changed'; end if;
  execute d;
end $$;
