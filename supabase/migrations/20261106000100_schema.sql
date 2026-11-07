begin;

create table public.contests (
    id uuid primary key default gen_random_uuid(),
    year integer not null unique check (year between 1000 and 9999),
    title text not null check (btrim(title) <> ''),
    created_at timestamptz not null default now()
);

create table public.voters (
    id uuid primary key default gen_random_uuid(),
    contest_id uuid not null references public.contests(id),
    key text not null check (key ~ '^[A-Za-z][A-Za-z0-9_-]*$'),
    name text not null check (btrim(name) <> ''),
    position integer not null check (position > 0),
    unique (contest_id, id),
    unique (contest_id, key),
    unique (contest_id, position)
);

create table public.entries (
    id uuid primary key default gen_random_uuid(),
    contest_id uuid not null references public.contests(id),
    "order" integer not null check ("order" > 0),
    country_code text not null check (country_code ~ '^[A-Z]{2}$'),
    country_name text not null check (btrim(country_name) <> ''),
    artist text,
    song text,
    unique (contest_id, id),
    unique (contest_id, "order"),
    unique (contest_id, country_code)
);

create table public.ratings (
    contest_id uuid not null references public.contests(id),
    entry_id uuid not null,
    voter_id uuid not null,
    value numeric check (value is null or (value between 0 and 10 and mod(value * 2, 1) = 0)),
    updated_at timestamptz not null default clock_timestamp(),
    revision bigint not null default 1 check (revision > 0),
    primary key (entry_id, voter_id),
    foreign key (contest_id, entry_id) references public.entries(contest_id, id),
    foreign key (contest_id, voter_id) references public.voters(contest_id, id)
);
create index ratings_contest_id_idx on public.ratings(contest_id);
create index ratings_voter_id_idx on public.ratings(voter_id);

create table public.approved_editors (
    user_id uuid primary key references auth.users(id) on delete cascade
);

create function public.stamp_rating() returns trigger
language plpgsql set search_path = '' as $$
begin
    if TG_OP = 'INSERT' then
        NEW.revision := 1;
    else
        NEW.revision := OLD.revision + 1;
    end if;
    NEW.updated_at := clock_timestamp();
    return NEW;
end;
$$;
revoke all on function public.stamp_rating() from public, anon, authenticated;
create trigger stamp_rating before insert or update on public.ratings
for each row execute function public.stamp_rating();

-- RLS is enabled in the same transaction as table creation, before any grants.
alter table public.contests enable row level security;
alter table public.voters enable row level security;
alter table public.entries enable row level security;
alter table public.ratings enable row level security;
alter table public.approved_editors enable row level security;
revoke all on public.contests, public.voters, public.entries, public.ratings, public.approved_editors from public, anon, authenticated;

commit;
