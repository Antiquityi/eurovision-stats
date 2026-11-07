-- Isolated database only. Test rows and identities roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000081'),('00000000-0000-0000-0000-000000000082');
insert into public.approved_editors values ('00000000-0000-0000-0000-000000000081');
insert into public.contests(id,year,title) values ('00000000-0000-0000-0000-000000000001',2098,'Tie test');
insert into public.voters(id,contest_id,key,name,position) values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','v','V',1);
insert into public.entries(id,contest_id,"order",country_code,country_name) values
('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001',1,'PL','Polska'),
('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',2,'FR','Francja');
insert into public.ratings(contest_id,entry_id,voter_id,value)
select contest_id,id,'00000000-0000-0000-0000-000000000011',6.5 from public.entries where contest_id='00000000-0000-0000-0000-000000000001';

set local role anon;
select throws_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','total',6.5,array['00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000021']::uuid[])$$,'42501',null,'anonymous denied');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000082","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','total',6.5,array['00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000021']::uuid[])$$,'42501',null,'unapproved denied');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000081","role":"authenticated"}',true);
set local role authenticated;

select lives_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','total',6.5,array['00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000021']::uuid[])$$,'approved editor resolves tie');
select is((select tie_breaks->'total'->'13:00000000-0000-0000-0000-000000000021,00000000-0000-0000-0000-000000000022'->>0 from public.contests where year=2098),'00000000-0000-0000-0000-000000000022','saved order matches frontend fingerprint');
select is((select sum(value) from public.ratings where contest_id='00000000-0000-0000-0000-000000000001'),13::numeric,'scores unchanged');
select throws_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','total',6,array['00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000021']::uuid[])$$,'22023',null,'stale score rejected');
select throws_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','total',6.5,array['00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000021']::uuid[])$$,'22023',null,'duplicate country rejected');
select throws_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','other-year-voter',6.5,array['00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000021']::uuid[])$$,'22023',null,'unknown scope rejected');
select throws_ok($$update public.contests set tie_breaks='{}'$$,'42501',null,'direct metadata writes denied');
select lives_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011',6.5,array['00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000022']::uuid[])$$,'individual tie saved independently');
select lives_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','total',6.5,array['00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000022']::uuid[],true)$$,'reset succeeds');
select is((select tie_breaks->'total' from public.contests where year=2098),'{}'::jsonb,'reset restores shared places');
select ok((select tie_breaks ? '00000000-0000-0000-0000-000000000011' from public.contests where year=2098),'other scope remains');
reset role;
update public.ratings set value=7 where entry_id='00000000-0000-0000-0000-000000000021';
set local role authenticated;
select throws_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','total',6.5,array['00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000022']::uuid[])$$,'22023',null,'changed members rejected');
reset role;
delete from public.approved_editors where user_id='00000000-0000-0000-0000-000000000081';
set local role authenticated;
select throws_ok($$select public.resolve_podium_tie('00000000-0000-0000-0000-000000000001','total',6.5,array['00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000022']::uuid[])$$,'42501',null,'revocation blocks immediately');
reset role;
select * from finish();
rollback;
