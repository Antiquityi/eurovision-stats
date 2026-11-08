-- Run only in an isolated database; all test data rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.contests (id, year, title) values
('00000000-0000-0000-0000-000000000001', 2098, 'Entry test A'),
('00000000-0000-0000-0000-000000000002', 2099, 'Entry test B');
insert into public.entries (id, contest_id, "order", country_code, country_name) values
('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 1, 'PL', 'Polska');
insert into auth.users (id) values
('00000000-0000-0000-0000-000000000051'), ('00000000-0000-0000-0000-000000000052');
insert into public.approved_editors values ('00000000-0000-0000-0000-000000000051');

set local role anon;
select is((select artist_song from public.entries where id = '00000000-0000-0000-0000-000000000011'), '', 'existing entries start blank and are public');
select throws_ok($$select public.set_entry_details('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Denied')$$,
'42501', null, 'anonymous RPC denied');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000052","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.set_entry_details('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Denied')$$,
'42501', null, 'unapproved RPC denied');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000051","role":"authenticated"}', true);
set local role authenticated;
select is(public.set_entry_details('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '  Artysta — Utwór  '), 'Artysta — Utwór', 'approved editor saves trimmed Unicode');
select is((select artist_song from public.entries where id = '00000000-0000-0000-0000-000000000011'), 'Artysta — Utwór', 'combined field persisted');
select throws_ok($$select public.set_entry_details('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 'Denied')$$,
'P0002', null, 'cross-contest entry denied');
select throws_ok($$select public.set_entry_details('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', repeat('x', 201))$$,
'22023', null, 'oversize text denied');
select throws_ok($$select public.set_entry_details('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', null)$$,
'22023', null, 'null input denied');
select throws_ok($$update public.entries set artist_song = 'Direct write'$$, '42501', null, 'direct table updates denied');
select is(public.set_entry_details('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '  '), '', 'clearing supported');
select is((select country_name from public.entries where id = '00000000-0000-0000-0000-000000000011'), 'Polska', 'country unchanged');

reset role;
select * from finish();
rollback;
