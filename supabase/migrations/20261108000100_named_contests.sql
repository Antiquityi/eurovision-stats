begin;

-- Allow distinct contests such as Eurowizja 2026 and 2026 ASIA in the same year.
alter table public.contests drop constraint contests_year_key;
alter table public.contests add constraint contests_year_title_key unique (year, title);

commit;
