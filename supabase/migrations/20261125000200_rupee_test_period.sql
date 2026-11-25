-- A temporary ₹1 "test" period on the Pro plan, so the live Razorpay flow can be tried with real money for almost nothing.
-- Remove later: delete the 'test' period from the edge function and the Billing page, then drop these rows.
do $$
declare
  t text;
  c text;
begin
  foreach t in array array['razorpay_plans', 'billing_subscriptions', 'subscriptions'] loop
    for c in
      select con.conname from pg_constraint con
      where con.conrelid = ('public.' || t)::regclass and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%period%'
    loop
      execute format('alter table public.%I drop constraint %I', t, c);
    end loop;
  end loop;
end $$;

alter table public.razorpay_plans add constraint razorpay_plans_period_check check (period in ('month', 'year', 'test'));
alter table public.billing_subscriptions add constraint billing_subscriptions_period_check check (period in ('month', 'year', 'test'));
alter table public.subscriptions add constraint subscriptions_period_check check (period in ('month', 'year', 'referral', 'admin', 'test'));
