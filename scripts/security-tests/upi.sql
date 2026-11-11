-- Direct UPI payments: buyer, creator and admin flows. Runs in one transaction that always rolls back.
-- Run with: node scripts/security-tests/run-sql.mjs scripts/security-tests/upi.sql
begin;

-- @MIGRATION@ (run-sql.mjs puts the UPI migration here while it is not yet applied)

create temp table results (n serial, test text, ok boolean, detail text);
grant all on results to anon, authenticated;
grant usage on sequence results_n_seq to anon, authenticated;
create temp table ids as
  select '0885536c-37ae-4506-868a-43b72835d98b'::uuid a, '082c897a-0a5b-4b4b-b7ab-6103a12eb089'::uuid b,
         (select id from public.pages where owner_id = '0885536c-37ae-4506-868a-43b72835d98b' limit 1) a_page,
         (select id from public.products pr where pr.page_id = (select id from public.pages where owner_id = '0885536c-37ae-4506-868a-43b72835d98b' limit 1)
            and pr.is_published and pr.type = 'digital' and coalesce(pr.sale_price_inr, pr.price_inr) > 0 limit 1) a_product;
grant select on ids to anon, authenticated;
create temp table state (k text primary key, v text);
grant all on state to anon, authenticated;

create or replace function pg_temp.expect(p_test text, p_sql text, p_want text) returns void language plpgsql as $$
declare v_rows bigint; v_got text;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    v_got := 'rows=' || v_rows;
  exception when others then
    v_got := 'error: ' || left(sqlerrm, 70);
  end;
  insert into results (test, ok, detail) values (p_test, v_got = p_want or (p_want = 'error' and v_got like 'error%'), v_got);
end $$;
create or replace function pg_temp.check(p_test text, p_ok boolean, p_detail text) returns void language sql as $$
  insert into results (test, ok, detail) values (p_test, coalesce(p_ok, false), p_detail);
$$;
grant execute on function pg_temp.expect(text, text, text), pg_temp.check(text, boolean, text) to anon, authenticated;

-- Creator A adds a UPI ID; a bad one is refused
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select a from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.expect('01 Invalid UPI ID is refused', format('update public.pages set upi_id = ''not a upi'' where id = %L', (select a_page from ids)), 'error');
select pg_temp.expect('02 Creator saves their UPI ID', format('update public.pages set upi_id = ''creator.test@okaxis'', upi_name = ''Test Creator'' where id = %L', (select a_page from ids)), 'rows=1');
reset role;

-- A visitor buys: the order waits for payment, and nothing unlocks yet
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.check('03 Page reports UPI mode', public.page_payment_mode((select a_page from ids)) = 'upi', 'upi');
insert into state select 'token', public.checkout_order((select a_product from ids), 'Buyer', 'upi-buyer@test.invalid', null) ->> 'token';
select pg_temp.check('04 Checkout returns an order link', (select v from state where k = 'token') is not null, 'token');
select pg_temp.check('05 Order waits for payment, with no access', (select (o ->> 'status') = 'pending' and o2 -> 'access' = 'null'::jsonb
  from (select public.get_order((select v from state where k = 'token')) -> 'order' o, public.get_order((select v from state where k = 'token')) o2) t), 'pending, no access');
select pg_temp.check('06 Payment details show the creator''s UPI and amount', (select p ->> 'upi_id' = 'creator.test@okaxis' and (p ->> 'amount_inr')::int > 0 and p ->> 'note' like 'Order %'
  from (select public.get_upi_payment((select v from state where k = 'token')) p) t), 'upi id, amount, note');
select pg_temp.expect('07 A wrong reference is refused', format('select public.submit_upi_reference(%L, ''12345'')', (select v from state where k = 'token')), 'error');
select pg_temp.expect('08 Buyer submits the 12-digit reference', format('select public.submit_upi_reference(%L, ''4123 5678 9012'')', (select v from state where k = 'token')), 'rows=1');
select pg_temp.expect('09 Visitors cannot confirm payments', format('select public.confirm_upi_order((select id from public.orders where access_token = %L))', (select v from state where k = 'token')), 'error');
select pg_temp.expect('10 Internal helper is not callable', format('select public.make_upi_pending(%L)', (select v from state where k = 'token')), 'error');
-- A second order can't reuse the same reference
insert into state select 'token2', public.checkout_order((select a_product from ids), 'Buyer 2', 'upi-buyer2@test.invalid', null) ->> 'token';
select pg_temp.expect('11 The same reference cannot be used twice', format('select public.submit_upi_reference(%L, ''412356789012'')', (select v from state where k = 'token2')), 'error');
reset role;
insert into state select 'order', id::text from public.orders where access_token = (select v from state where k = 'token');
insert into state select 'order2', id::text from public.orders where access_token = (select v from state where k = 'token2');
insert into state select 'sales', sales_count::text from public.products where id = (select a_product from ids);

-- Creator B can't touch A's orders
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select b from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.expect('12 Another creator cannot confirm it', format('select public.confirm_upi_order(%L)', (select v from state where k = 'order')), 'error');
select pg_temp.expect('13 Another creator cannot reject it', format('select public.reject_upi_order(%L, ''x'')', (select v from state where k = 'order')), 'error');
-- Creator A confirms one and rejects the other
select set_config('request.jwt.claims', json_build_object('sub', (select a from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.check('14 Creator sees the reference and when it was sent', (select payment_ref = '412356789012' and payment_submitted_at is not null from public.orders where id = (select v from state where k = 'order')::uuid), 'utr + time');
select pg_temp.expect('15 Creator confirms the payment', format('select public.confirm_upi_order(%L)', (select v from state where k = 'order')), 'rows=1');
select pg_temp.expect('16 Creator rejects the unpaid one', format('select public.reject_upi_order(%L, ''Not in my bank'')', (select v from state where k = 'order2')), 'rows=1');
select pg_temp.expect('17 A confirmed order cannot be confirmed again', format('select public.confirm_upi_order(%L)', (select v from state where k = 'order')), 'error');
reset role;
select pg_temp.check('18 Confirmed order now opens for the buyer', (select public.get_order((select v from state where k = 'token')) -> 'order' ->> 'status' = 'paid'
  and public.get_order((select v from state where k = 'token')) -> 'access' <> 'null'::jsonb), 'paid, access');
select pg_temp.check('19 Rejected order is closed with the reason', (select status = 'failed' and refund_reason = 'Not in my bank' from public.orders where id = (select v from state where k = 'order2')::uuid), 'failed');
select pg_temp.check('20 Rejecting gives back the reserved stock', (select sales_count = (select v from state where k = 'sales')::int - 1 from public.products where id = (select a_product from ids)), 'sales count');

-- Without a UPI ID, test mode works as before (switched on here only; it rolls back)
select set_config('request.jwt.claims', '', true);
update public.app_settings set test_payments = true;
update public.pages set upi_id = null where id = (select a_page from ids);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into state select 'test_token', public.checkout_order((select a_product from ids), 'T', 'test-mode@test.invalid', null) ->> 'token';
select pg_temp.check('21 Without UPI, test checkout still completes', (select public.get_order((select v from state where k = 'test_token')) -> 'order' ->> 'status') = 'paid', 'paid');
reset role;
update public.pages set upi_id = 'creator.test@okaxis' where id = (select a_page from ids);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into state select 'tip_token', public.checkout_tip((select a_page from ids), 50, 'Fan', 'tip@test.invalid', 'hi') ->> 'token';
select pg_temp.check('22 Tips wait for payment on UPI pages', (select public.get_upi_payment((select v from state where k = 'tip_token')) ->> 'status') = 'pending', 'pending');
reset role;

-- With no UPI and test payments off: paid things wait, free things still work
select set_config('request.jwt.claims', '', true);
update public.app_settings set test_payments = false;
update public.pages set upi_id = null where id = (select a_page from ids);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.check('22b Page reports payments off', public.page_payment_mode((select a_page from ids)) = 'off', 'off');
select pg_temp.expect('22c Paid checkout is refused until UPI is added', format('select public.checkout_order(%L, ''T'', ''off@test.invalid'', null)', (select a_product from ids)), 'error');
select pg_temp.expect('22d Tips are refused until UPI is added', format('select public.checkout_tip(%L, 50, ''T'', ''off@test.invalid'', null)', (select a_page from ids)), 'error');
reset role;

-- Plan upgrade paid to the platform's UPI
select pg_temp.check('23 Plan payments closed until a platform UPI is set', true, 'checked below');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select a from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.expect('23 Plan payments are closed until a platform UPI is set', 'select public.request_plan_payment(''pro'', ''month'', ''555566667777'')', 'error');
reset role;
delete from results where test = '23 Plan payments closed until a platform UPI is set';
update public.app_settings set platform_upi_id = 'platform.test@okhdfcbank', platform_upi_name = 'Platform';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select a from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.check('24 Creator sees where to pay for a plan', (select public.plan_payment_info() ->> 'upi_id') = 'platform.test@okhdfcbank', 'platform upi');
select pg_temp.expect('25 Creator sends a plan payment reference', 'select public.request_plan_payment(''pro'', ''month'', ''555566667777'')', 'rows=1');
select pg_temp.expect('26 Only one waiting payment at a time', 'select public.request_plan_payment(''pro'', ''year'', ''555566668888'')', 'error');
select pg_temp.expect('27 Creator cannot approve their own payment', format('select public.admin_review_plan_payment(%L, true)', (select id from public.plan_payments where user_id = (select a from ids))), 'error');
select pg_temp.expect('28 Creator cannot change the platform UPI', 'select public.admin_set_platform_upi(''me@okaxis'', ''Me'')', 'error');
select pg_temp.check('29 Plan still unchanged before approval', (select plan = 'free' or plan_expires_at < now() from public.profiles where id = (select a from ids)), 'free');
reset role;
-- An admin (B, inside this transaction only) approves it
select set_config('request.jwt.claims', '', true);
update public.profiles set role = 'admin' where id = (select b from ids);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select b from ids), 'role', 'authenticated', 'aal', 'aal2')::text, true);
select pg_temp.expect('30 Admin approves the plan payment', format('select public.admin_review_plan_payment(%L, true)', (select id from public.plan_payments where user_id = (select a from ids))), 'rows=1');
reset role;
select pg_temp.check('31 Creator is now on Pro for a month', (select plan = 'pro' and plan_expires_at > now() + interval '27 days' from public.profiles where id = (select a from ids)), 'pro');
select pg_temp.check('32 The upgrade shows in plan history', (select count(*) = 1 from public.subscriptions where user_id = (select a from ids) and provider = 'upi'), 'subscription row');

select n, case when ok then 'PASS' else 'FAIL' end as result, test, detail from results order by n;
rollback;
