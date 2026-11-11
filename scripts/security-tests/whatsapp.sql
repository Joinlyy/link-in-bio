-- WhatsApp alerts: settings, opt-in, access to the message log, and that the database pings the
-- function. Runs in one transaction that always rolls back (queued pings are discarded too).
-- Run with: node scripts/security-tests/run-sql.mjs scripts/security-tests/whatsapp.sql
begin;

-- @MIGRATION@ (run-sql.mjs puts unapplied migrations here)

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

-- Creator A sets an alert number
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select a from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.expect('01 A wrong alert number is refused', format('update public.pages set alert_whatsapp = ''98765'' where id = %L', (select a_page from ids)), 'error');
select pg_temp.expect('02 Creator turns alerts on', format('update public.pages set alert_whatsapp = ''919876543210'', alert_on = true, upi_id = ''creator.test@okaxis'' where id = %L', (select a_page from ids)), 'rows=1');
reset role;

-- A buyer checks out and opts in; the database queues a ping to the function
select set_config('request.jwt.claims', '', true);
insert into state select 'queue_before', count(*)::text from net.http_request_queue;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into state select 'token', public.checkout_order((select a_product from ids), 'Buyer', 'wa-buyer@test.invalid', '98765 43210', null, null, null, null, true) ->> 'token';
insert into state select 'token_no', public.checkout_order((select a_product from ids), 'Buyer 2', 'wa-buyer2@test.invalid', null, null, null, null, null, true) ->> 'token';
select pg_temp.expect('03 Visitors cannot read the message log', 'select * from public.notifications', 'error');
select pg_temp.expect('04 Visitors cannot trigger alerts directly', format('select public.notify_whatsapp(''order'', %L)', (select a_product from ids)), 'error');
reset role;
select set_config('request.jwt.claims', '', true);
select pg_temp.check('05 Buyer who opted in with a number is marked for updates', (select wa_updates from public.orders where access_token = (select v from state where k = 'token')), 'wa_updates');
select pg_temp.check('06 Opting in without a number does nothing', (select not wa_updates from public.orders where access_token = (select v from state where k = 'token_no')), 'no number');

-- Sending the UPI reference queues a ping for the creator's alert
update public.orders set payment_ref = '555566667777', payment_submitted_at = now() where access_token = (select v from state where k = 'token');
select pg_temp.check('07 The database pinged the whatsapp function', (select count(*) > (select v from state where k = 'queue_before')::int from net.http_request_queue where url like '%/functions/v1/whatsapp'), 'queued');
select pg_temp.check('08 Pings carry only the kind and id', (select bool_and(convert_from(body, 'utf8')::jsonb ?& array['action', 'kind', 'id'] and not (convert_from(body, 'utf8') ~ 'buyer|phone|email')) from net.http_request_queue where url like '%/functions/v1/whatsapp'), 'no personal data');

-- The log: each page's team sees only its own messages
insert into public.notifications (key, page_id, event, recipient, template, status) values
  ('test:a', (select a_page from ids), 'test', 'test', 'creator_alerts_on', 'sent'),
  ('test:b', (select id from public.pages where owner_id = (select b from ids) limit 1), 'test', 'test', 'creator_alerts_on', 'sent');
select pg_temp.expect('09 The same alert can''t be recorded twice', format('insert into public.notifications (key, page_id, event, recipient, template) values (''test:a'', %L, ''test'', ''test'', ''x'')', (select a_page from ids)), 'error');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select a from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.check('10 Creator sees their own alerts only', (select count(*) = 1 and bool_and(key = 'test:a') from public.notifications where key like 'test:%'), 'own only');
select pg_temp.expect('11 Creators cannot write to the log', 'update public.notifications set status = ''read''', 'error');
reset role;

select n, case when ok then 'PASS' else 'FAIL' end as result, test, detail from results order by n;
rollback;
