begin;

-- Keep applied migration history intact; the scoreboard needs neither field.
alter table public.entries
    drop column if exists artist,
    drop column if exists song;

commit;
