-- Run as owner ONLY in a disposable development project after all migrations.
-- This creates a deliberately synthetic year; it never overwrites an existing year.
begin;
do $$
declare contest uuid;
begin
    if exists (select 1 from public.contests where year = 2099) then
        raise exception 'Year 2099 already exists; no test data was changed';
    end if;
    insert into public.contests (year, title) values (2099, 'Eurowizja 2099 — dane testowe') returning id into contest;
    insert into public.voters (contest_id, key, name, position) values
        (contest, 'anna', 'Anna', 1), (contest, 'jan', 'Jan', 2);
    insert into public.entries (contest_id, "order", country_code, country_name) values
        (contest, 1, 'PL', 'Polska'), (contest, 2, 'SE', 'Szwecja'), (contest, 3, 'DK', 'Dania');
    insert into public.ratings (contest_id, entry_id, voter_id, value)
        select contest, e.id, v.id, null
        from public.entries e cross join public.voters v
        where e.contest_id = contest and v.contest_id = contest;
end;
$$;
commit;
