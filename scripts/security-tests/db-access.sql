-- Security tests. Runs the hardening migration and every check inside ONE transaction that is
-- rolled back at the end, so the live database is never changed. Prints PASS/FAIL per test.
begin;

-- @MIGRATION@ (run-db.mjs puts the hardening migration here while it is not yet applied)

create temp table results (n serial, test text, ok boolean, detail text);
grant all on results to anon, authenticated;
grant usage on sequence results_n_seq to anon, authenticated;

-- Creator A and Creator B: two existing accounts (ids below). Nothing is printed from their data, and everything rolls back.
create temp table ids as
  select '0885536c-37ae-4506-868a-43b72835d98b'::uuid a, '082c897a-0a5b-4b4b-b7ab-6103a12eb089'::uuid b,
         (select id from public.pages where owner_id = '0885536c-37ae-4506-868a-43b72835d98b' limit 1) a_page,
         (select id from public.pages where owner_id = '082c897a-0a5b-4b4b-b7ab-6103a12eb089' limit 1) b_page,
         (select username from public.pages where owner_id = '0885536c-37ae-4506-868a-43b72835d98b' limit 1) a_user,
         (select pr.id from public.products pr join public.pages pg on pg.id = pr.page_id where pg.owner_id = '0885536c-37ae-4506-868a-43b72835d98b' and pr.is_published and pr.type <> 'link' limit 1) a_product;
grant select on ids to anon, authenticated;
-- Something private on B's page to look for
insert into public.leads (page_id, email, consent, consent_text) select b_page, 'b-private-lead@test.invalid', true, 'test' from ids;

-- Runs a statement as a role; records whether it was refused or how many rows it touched
create or replace function pg_temp.expect(p_test text, p_sql text, p_want text) returns void language plpgsql as $$
declare v_rows bigint; v_got text;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    v_got := 'rows=' || v_rows;
  exception when others then
    v_got := 'error';
  end;
  insert into results (test, ok, detail) values (p_test, v_got = p_want or (p_want = 'rows=0|error' and v_got in ('rows=0', 'error')), v_got);
end $$;
create or replace function pg_temp.check(p_test text, p_ok boolean, p_detail text) returns void language sql as $$
  insert into results (test, ok, detail) values (p_test, p_ok, p_detail);
$$;
grant execute on function pg_temp.expect(text, text, text), pg_temp.check(text, boolean, text) to anon, authenticated;

-- ===================== Anonymous visitor =====================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.expect('01 Anon cannot read pages table', 'select * from public.pages', 'error');
select pg_temp.expect('02 Anon cannot read leads', 'select * from public.leads', 'error');
select pg_temp.expect('03 Anon cannot read orders', 'select * from public.orders', 'error');
select pg_temp.expect('04 Anon cannot read profiles', 'select * from public.profiles', 'error');
select pg_temp.expect('05 Anon cannot update a public profile page', 'update public.pages set bio = ''hacked''', 'error');
select pg_temp.expect('06 Anon cannot change plans (TRUNCATE revoked too)', 'truncate public.plans', 'error');
select pg_temp.expect('07 Anon cannot call admin tools', 'select public.admin_stats()', 'error');
select pg_temp.expect('08 Anon cannot upgrade a plan', 'select public.test_upgrade(''pro'', ''month'')', 'error');
select pg_temp.expect('09 Anon cannot read private product files', 'select * from storage.objects where bucket_id = ''product-files''', 'rows=0');
select pg_temp.expect('10 Anon cannot upload images', 'insert into storage.objects (bucket_id, name) values (''creator-images'', ''x/evil.png'')', 'error');
select pg_temp.check('11 Public page API exposes no private fields',
  (select r::text !~ '(billing|owner_id|domain_token|buyer_email|access_token|"email")' from (select public.get_public_page((select a_user from ids))) t(r)),
  'checked billing, owner_id, domain_token, buyer emails, tokens');
select pg_temp.check('12 Unpublished or missing pages return nothing', public.get_public_page('no-such-user-xyz') is null, 'null');
reset role;

-- ===================== Creator A =====================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select a from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.check('13 A cannot read B''s leads', (select count(*) = 0 from public.leads where page_id = (select b_page from ids)), 'count 0');
select pg_temp.check('14 A cannot read B''s page row', (select count(*) = 0 from public.pages where id = (select b_page from ids)), 'count 0');
select pg_temp.check('15 A cannot read B''s profile', (select count(*) = 0 from public.profiles where id = (select b from ids)), 'count 0');
select pg_temp.expect('16 A cannot update B''s page', format('update public.pages set bio = %L where id = %L', 'hacked', (select b_page from ids)), 'rows=0');
select pg_temp.expect('17 A cannot add blocks to B''s page', format('insert into public.blocks (page_id, type, data) values (%L, ''text'', ''{}'')', (select b_page from ids)), 'error');
select pg_temp.expect('18 A cannot invite themselves to B''s team', format('insert into public.page_members (page_id, email, role) values (%L, ''a@test.invalid'', ''admin'')', (select b_page from ids)), 'error');
select pg_temp.expect('19 A cannot read B''s audience', format('select public.audience(%L)', (select b_page from ids)), 'error');
select pg_temp.expect('20 A cannot reorder B''s sections', format('select public.reorder_blocks(%L, ''{}'')', (select b_page from ids)), 'error');
select pg_temp.expect('21 A cannot upload into B''s image folder', format('insert into storage.objects (bucket_id, name) values (''creator-images'', %L)', (select b from ids) || '/x.png'), 'error');
select pg_temp.check('22 A cannot list B''s private files', (select count(*) = 0 from storage.objects where bucket_id = 'product-files' and name like (select b from ids) || '/%'), 'count 0');
select pg_temp.expect('23 A cannot read buyers'' order tokens', 'select access_token from public.orders', 'error');
select pg_temp.expect('24 A can still read their orders without the token', 'select id, amount_inr, status from public.orders', (select 'rows=' || count(*) from public.orders o where o.page_id = (select a_page from ids)));
select pg_temp.expect('24b The Sales screen''s column list still works', 'select id, page_id, product_id, kind, product_title, product_type, buyer_name, buyer_email, buyer_phone, note, amount_inr, discount_inr, coupon_code, status, payment_provider, payment_ref, downloads, created_at, paid_at, question, answer, answered_at, access_expires_at, refunded_at, refund_reason, refunded_by, upsell_of from public.orders', (select 'rows=' || count(*) from public.orders o where o.page_id = (select a_page from ids)));
select pg_temp.expect('25 Dangerous link scheme is rejected', format('insert into public.blocks (page_id, type, data) values (%L, ''link'', ''{"title":"x","url":"javascript:alert(1)"}'')', (select a_page from ids)), 'error');
select pg_temp.expect('26 data: links rejected in cards too', format('insert into public.blocks (page_id, type, data) values (%L, ''cards'', ''{"items":[{"title":"x","url":"data:text/html,<script>alert(1)</script>"}]}'')', (select a_page from ids)), 'error');
-- Role escalation
update public.profiles set role = 'admin', status = 'active', plan = 'business', plan_expires_at = now() + interval '9 years' where id = (select a from ids);
select pg_temp.check('27 A cannot make themselves admin or change plan', (select role = 'creator' and plan is distinct from 'business' from public.profiles where id = (select a from ids)), 'role and plan unchanged');
select pg_temp.expect('28 A cannot take over another page by owner_id', format('update public.pages set owner_id = %L where id = %L', (select b from ids), (select a_page from ids)), 'rows=1');
select pg_temp.check('28b ...owner_id stayed with A', (select owner_id = (select a from ids) from public.pages where id = (select a_page from ids)), 'unchanged');
select pg_temp.expect('29 A cannot unhide a page hidden by moderators', format('update public.pages set moderation_status = ''ok'' where id = %L', (select a_page from ids)), 'rows=1');
select pg_temp.expect('30 A cannot self-activate a custom domain', format('update public.pages set domain_status = ''active'' where id = %L', (select a_page from ids)), 'rows=1');
select pg_temp.check('30b ...domain_status not active', (select domain_status is distinct from 'active' from public.pages where id = (select a_page from ids)), 'unchanged');
select pg_temp.expect('31 Support: A cannot rewrite messages as admin', 'update public.support_messages set sender = ''admin''', 'error');
select pg_temp.expect('32 A cannot read admin tables', 'select * from public.admin_audit', 'rows=0');
select pg_temp.expect('33 A cannot change app settings', 'update public.app_settings set test_payments = false', 'error');
reset role;

-- ===================== Administrator (role set inside this transaction only) =====================
select set_config('request.jwt.claims', '', true); -- setup runs as the database, not as a user
update public.profiles set role = 'admin' where id = (select b from ids);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select b from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.expect('34 Admin without two-step login is refused', 'select public.admin_stats()', 'error');
select set_config('request.jwt.claims', json_build_object('sub', (select b from ids), 'role', 'authenticated', 'aal', 'aal2')::text, true);
select pg_temp.expect('35 Admin with two-step login can use admin tools', 'select public.admin_stats()', 'rows=1');
select pg_temp.check('36 Admin with two-step login can read all pages', (select count(*) >= 2 from public.pages), 'all pages');
reset role;
select set_config('request.jwt.claims', '', true); -- setup runs as the database, not as a user
update public.profiles set role = 'creator' where id = (select b from ids);

-- ===================== Suspended creator =====================
select set_config('request.jwt.claims', '', true); -- setup runs as the database, not as a user
update public.profiles set status = 'suspended' where id = (select a from ids);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select a from ids), 'role', 'authenticated', 'aal', 'aal1')::text, true);
select pg_temp.expect('37 Suspended creator cannot edit their page', format('update public.pages set bio = ''x'' where id = %L', (select a_page from ids)), 'rows=0');
select pg_temp.expect('38 Suspended creator cannot add sections', format('insert into public.blocks (page_id, type, data) values (%L, ''text'', ''{}'')', (select a_page from ids)), 'error');
select pg_temp.expect('39 Suspended creator cannot upload', format('insert into storage.objects (bucket_id, name) values (''creator-images'', %L)', (select a from ids) || '/x.png'), 'error');
select pg_temp.check('40 Suspended creator can still read their own profile (to see why)', (select count(*) = 1 from public.profiles where id = (select a from ids)), 'own profile');
reset role;
select set_config('request.jwt.claims', '', true); -- setup runs as the database, not as a user
update public.profiles set status = 'active' where id = (select a from ids);

-- ===================== Test-mode payments switch =====================
select set_config('request.jwt.claims', '', true); -- setup runs as the database, not as a user
update public.app_settings set test_payments = false;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.expect('41 With test payments off, free checkout is refused',
  format('select public.create_test_order(%L, ''T'', ''t@test.invalid'', null)', (select a_product from ids)), 'error');
select pg_temp.expect('42 With test payments off, free tips are refused', format('select public.create_test_tip(%L, 100, ''T'', ''t@test.invalid'', null)', (select a_page from ids)), 'error');
reset role;

-- ===================== Public forms still work =====================
select set_config('request.jwt.claims', '', true); -- setup runs as the database, not as a user
update public.app_settings set test_payments = true;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.expect('43 Visitors can still join a lead form', format('select public.submit_lead(%L, null, ''T'', ''new-lead@test.invalid'', null, true, ''ok'')', (select a_page from ids)), 'rows=1');
select pg_temp.expect('44 Internal *_impl functions are not callable', format('select public.submit_lead_impl(%L, null, ''T'', ''x@test.invalid'', null, true, ''ok'')', (select a_page from ids)), 'error');
reset role;

select n, case when ok then 'PASS' else 'FAIL' end as result, test, detail from results order by n;
rollback;
