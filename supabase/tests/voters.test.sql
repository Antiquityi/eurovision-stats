-- Isolated database only. Everything, including test auth users, rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.contests (id, year, title) values
('00000000-0000-0000-0000-000000000001', 2098, 'Voter test A'),
('00000000-0000-0000-0000-000000000002', 2099, 'Voter test B');
insert into public.entries (id, contest_id, "order", country_code, country_name) values
('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 1, 'PL', 'Polska'),
('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 2, 'SE', 'Szwecja'),
('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000002', 1, 'DK', 'Dania');
insert into public.voters (id, contest_id, key, name, position) values
('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', 'existing', 'Existing', 1),
('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000002', 'existing', 'Other year', 1);
insert into public.ratings (contest_id, entry_id, voter_id, value)
select e.contest_id, e.id, v.id, 7.5 from public.entries e
join public.voters v on e.contest_id = v.contest_id;
insert into auth.users (id) values
('00000000-0000-0000-0000-000000000051'), ('00000000-0000-0000-0000-000000000052');
insert into public.approved_editors values ('00000000-0000-0000-0000-000000000051');
create temporary table added_person (id uuid);
grant select, insert on added_person to authenticated;

set local role anon;
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'add', null, 'Denied')$$,
'42501', null, 'anonymous RPC denied');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000052","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'add', null, 'Denied')$$,
'42501', null, 'unapproved RPC denied');
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'delete', '00000000-0000-0000-0000-000000000031')$$,
'42501', null, 'unapproved deletion denied');
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'rename', '00000000-0000-0000-0000-000000000031', 'Denied')$$,
'42501', null, 'unapproved rename denied');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000051","role":"authenticated"}', true);
set local role authenticated;

insert into added_person select public.manage_voter('00000000-0000-0000-0000-000000000001', 'add', '00000000-0000-0000-0000-000000000061', '  Łukasz  ');
select lives_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'add', (select id from added_person), 'Łukasz')$$, 'add retry is idempotent');
select is((select count(*) from public.voters where contest_id = '00000000-0000-0000-0000-000000000001'), 2::bigint, 'add retry creates no duplicate column');
select is((select name from public.voters where id = (select id from added_person)), 'Łukasz', 'trimmed Unicode name');
select is((select position from public.voters where id = (select id from added_person)), 2, 'appended position');
select is((select count(*) from public.ratings where voter_id = (select id from added_person) and value is null), 2::bigint, 'blank rating per entry');
select is((select count(*) from public.ratings where value = 7.5), 3::bigint, 'existing scores preserved');
select lives_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'rename', (select id from added_person), 'Ewa')$$, 'rename succeeds');
select is((select name from public.voters where id = (select id from added_person)), 'Ewa', 'name changed without identity change');
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'rename', '00000000-0000-0000-0000-000000000041', 'Denied')$$,
'P0002', null, 'cross-contest rename denied');
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'delete', '00000000-0000-0000-0000-000000000041')$$,
'P0002', null, 'cross-contest deletion denied');
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'add', null, '  ')$$,
'22023', null, 'empty name rejected');
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'add', null, repeat('x',81))$$,
'22023', null, 'oversize name rejected');
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'invalid')$$,
'22023', null, 'unknown action rejected');
select throws_ok($$update public.voters set name = 'Direct update'$$, '42501', null, 'direct writes stay denied');
select lives_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'delete', (select id from added_person))$$, 'delete succeeds');
select is((select count(*) from public.ratings where voter_id = (select id from added_person)), 0::bigint, 'deleted scores removed');
select is((select count(*) from public.voters where id = (select id from added_person)), 0::bigint, 'deleted voter removed');
select is((select name from public.voters where id = '00000000-0000-0000-0000-000000000041'), 'Other year', 'other years unchanged');
select is((select count(*) from public.ratings where value = 7.5), 3::bigint, 'other scores unchanged after delete');

reset role;
delete from public.approved_editors where user_id = '00000000-0000-0000-0000-000000000051';
set local role authenticated;
select throws_ok($$select public.manage_voter('00000000-0000-0000-0000-000000000001', 'add', null, 'Denied')$$,
'42501', null, 'revocation blocks RPC immediately');
reset role;
select * from finish();
rollback;
