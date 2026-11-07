-- Disposable database only. Test users, data and approvals are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.contests (id, year, title) values
('00000000-0000-0000-0000-000000000001', 2098, 'Disposable test A'),
('00000000-0000-0000-0000-000000000002', 2099, 'Disposable test B');
insert into public.voters (id, contest_id, key, name, position) values
('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', 'first', 'First', 1),
('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', 'second', 'Second', 2),
('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000002', 'first', 'First', 1);
insert into public.entries (id, contest_id, "order", country_code, country_name) values
('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 1, 'PL', 'Polska'),
('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000002', 1, 'DK', 'Dania');
insert into public.ratings (contest_id, entry_id, voter_id, value)
select e.contest_id, e.id, v.id, null
from public.entries e join public.voters v on v.contest_id = e.contest_id;

insert into auth.users (id) values
('00000000-0000-0000-0000-000000000051'),
('00000000-0000-0000-0000-000000000052'),
('00000000-0000-0000-0000-000000000053');
insert into public.approved_editors (user_id) values
('00000000-0000-0000-0000-000000000051'),
('00000000-0000-0000-0000-000000000053');

set local role anon;
select is((select count(*) from public.contests), 2::bigint, 'anonymous contest read');
select is((select count(*) from public.voters), 3::bigint, 'anonymous voter read');
select is((select count(*) from public.entries), 2::bigint, 'anonymous entry read');
select is((select count(*) from public.ratings), 3::bigint, 'anonymous rating read');
select throws_ok($$select * from public.approved_editors$$, '42501', null, 'anonymous cannot list auth UUIDs');
select throws_ok($$update public.ratings set value = 9$$, '42501', null, 'anonymous update denied');
select throws_ok($$insert into public.contests (year,title) values (2100,'denied')$$, '42501', null, 'anonymous structure write denied');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000052","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.ratings), 3::bigint, 'unapproved public read');
select is((select count(*) from public.approved_editors), 0::bigint, 'unapproved cannot list approvals');
select is((with changed as (update public.ratings set value = 9 returning *) select count(*) from changed), 0::bigint, 'unapproved write filtered by RLS');
select throws_ok($$insert into public.approved_editors values ('00000000-0000-0000-0000-000000000052')$$, '42501', null, 'cannot self-approve');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000051","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.approved_editors), 1::bigint, 'editor sees own approval only');
select is((with changed as (update public.ratings set value = 0.5 returning *) select count(*) from changed), 3::bigint, 'editor updates every voter across contests');
select is((select min(revision) from public.ratings), 2::bigint, 'server revision visible after value-only write');
select lives_ok($$update public.ratings set value = 0$$, 'editor can submit zero');
select lives_ok($$update public.ratings set value = null$$, 'editor can clear values');
select throws_ok($$update public.ratings set value = 2.2$$, '23514', null, 'editor cannot bypass half points');
select throws_ok($$update public.ratings set revision = 100$$, '42501', null, 'revision update forbidden');
select throws_ok($$update public.ratings set updated_at = now()$$, '42501', null, 'timestamp update forbidden');
select throws_ok($$update public.ratings set entry_id = entry_id$$, '42501', null, 'entry identity update forbidden');
select throws_ok($$update public.ratings set voter_id = voter_id$$, '42501', null, 'voter identity update forbidden');
select throws_ok($$update public.ratings set contest_id = contest_id$$, '42501', null, 'contest identity update forbidden');
select throws_ok($$insert into public.ratings (contest_id,entry_id,voter_id,value) values
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000031',10)$$,
'42501', null, 'editor cannot insert rating');
select throws_ok($$delete from public.ratings$$, '42501', null, 'editor cannot delete ratings');
select throws_ok($$update public.contests set title = 'denied'$$, '42501', null, 'editor cannot update structure');
select throws_ok($$insert into public.voters (contest_id,key,name,position) values
('00000000-0000-0000-0000-000000000001','third','Third',3)$$, '42501', null, 'editor cannot add voters');
select throws_ok($$delete from public.entries$$, '42501', null, 'editor cannot delete entries');
select throws_ok($$insert into public.approved_editors values ('00000000-0000-0000-0000-000000000052')$$, '42501', null, 'editor cannot approve others');
select throws_ok($$update public.approved_editors set user_id = user_id$$, '42501', null, 'editor cannot modify approvals');
select throws_ok($$delete from public.approved_editors$$, '42501', null, 'editor cannot remove approvals');

reset role;
delete from public.approved_editors where user_id = '00000000-0000-0000-0000-000000000051';
set local role authenticated;
select is((with changed as (update public.ratings set value = 10 returning *) select count(*) from changed), 0::bigint, 'owner revocation takes effect without token renewal');
reset role;
select * from finish();
rollback;
