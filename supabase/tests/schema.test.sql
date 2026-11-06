-- Run only against a disposable Supabase database; every change rolls back.
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

select lives_ok($$update public.ratings set value = 0$$, 'zero is submitted');
select lives_ok($$update public.ratings set value = 0.5$$, 'half point accepted');
select lives_ok($$update public.ratings set value = 10$$, 'upper bound accepted');
select lives_ok($$update public.ratings set value = null$$, 'blank accepted');
select throws_ok($$update public.ratings set value = -0.5$$, '23514', null, 'negative rejected');
select throws_ok($$update public.ratings set value = 10.5$$, '23514', null, 'above ten rejected');
select throws_ok($$update public.ratings set value = 1.25$$, '23514', null, 'quarter point rejected without rounding');
select throws_ok($$update public.ratings set value = 'NaN'$$, '23514', null, 'NaN rejected');
select throws_ok($$update public.ratings set value = 'oops'$$, '22P02', null, 'malformed value rejected');
select throws_ok($$insert into public.ratings (contest_id,entry_id,voter_id) values
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000041')$$,
'23503', null, 'cross-contest voter rejected');
select throws_ok($$insert into public.ratings (contest_id,entry_id,voter_id) values
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000041')$$,
'23503', null, 'cross-contest entry rejected');
select throws_ok($$insert into public.contests (year,title) values (2098,'duplicate')$$, '23505', null, 'unique years');
select throws_ok($$insert into public.contests (year,title) values (2100,' ')$$, '23514', null, 'nonempty title');
select throws_ok($$insert into public.entries (contest_id,"order",country_code,country_name) values
('00000000-0000-0000-0000-000000000001',0,'SE','Szwecja')$$, '23514', null, 'positive order');
select throws_ok($$insert into public.entries (contest_id,"order",country_code,country_name) values
('00000000-0000-0000-0000-000000000001',2,'pl','Polska')$$, '23514', null, 'uppercase country codes');
select throws_ok($$insert into public.entries (contest_id,"order",country_code,country_name) values
('00000000-0000-0000-0000-000000000001',1,'SE','Szwecja')$$, '23505', null, 'unique contest order');
select throws_ok($$insert into public.entries (contest_id,"order",country_code,country_name) values
('00000000-0000-0000-0000-000000000001',2,'PL','Polska')$$, '23505', null, 'unique contest country');
select throws_ok($$insert into public.voters (contest_id,key,name,position) values
('00000000-0000-0000-0000-000000000001','first','Duplicate',3)$$, '23505', null, 'unique voter key');
select throws_ok($$insert into public.voters (contest_id,key,name,position) values
('00000000-0000-0000-0000-000000000001','third','Third',1)$$, '23505', null, 'unique voter position');
select throws_ok($$insert into public.voters (contest_id,key,name,position) values
('00000000-0000-0000-0000-000000000001','bad key','Third',3)$$, '23514', null, 'ASCII voter identifier');
select is((select min(revision) from public.ratings), 5::bigint, 'revision increments once per successful update');
select lives_ok($$update public.ratings set revision = 900, updated_at = '2000-01-01'$$, 'trigger runs for owner updates');
select is((select min(revision) from public.ratings), 6::bigint, 'server overrides supplied revision');
select ok((select bool_and(updated_at > '2000-01-01'::timestamptz) from public.ratings), 'server overrides supplied timestamp');
select * from finish();
rollback;
