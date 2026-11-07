begin;

alter table public.contests add column tie_breaks jsonb not null default '{}'::jsonb;

-- Only approved editors may resolve a current podium tie. Scores are never changed.
create function public.resolve_podium_tie(
    p_contest_id uuid, p_scope text, p_score numeric, p_entry_ids uuid[], p_reset boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
    expected_ids uuid[];
    submitted_ids uuid[];
    higher_count integer;
    tie_key text;
    scope_choices jsonb;
begin
    perform 1 from public.approved_editors where user_id = auth.uid() for share;
    if not found then
        raise exception 'Editor approval required' using errcode = '42501';
    end if;
    perform 1 from public.contests where id = p_contest_id for update;
    if not found then
        raise exception 'Contest not found' using errcode = 'P0002';
    end if;
    if p_scope is null or (p_scope <> 'total' and not exists (
        select 1 from public.voters where contest_id = p_contest_id and id::text = p_scope
    )) then
        raise exception 'Invalid podium scope' using errcode = '22023';
    end if;
    if p_score is null or p_score < 0 or mod(p_score * 2, 1) <> 0
       or p_entry_ids is null or array_ndims(p_entry_ids) <> 1 or cardinality(p_entry_ids) < 2 or p_reset is null then
        raise exception 'Invalid tie selection' using errcode = '22023';
    end if;

    -- Keep confirmed scores stable during validation and publication of the choice.
    perform 1 from public.ratings where contest_id = p_contest_id for share;
    with scores as (
        select e.id, case when p_scope = 'total' then sum(r.value)
            else max(r.value) filter (where r.voter_id::text = p_scope) end as value
        from public.entries e left join public.ratings r on r.entry_id = e.id and r.contest_id = e.contest_id
        where e.contest_id = p_contest_id group by e.id
    )
    select array_agg(id order by id) filter (where value = p_score),
           count(*) filter (where value > p_score)
    into expected_ids, higher_count from scores;

    select array_agg(id order by id) into submitted_ids from unnest(p_entry_ids) as ids(id);
    if expected_ids is null or cardinality(expected_ids) < 2 or higher_count >= 3
       or submitted_ids is distinct from expected_ids then
        raise exception 'Tie changed; refresh results and try again' using errcode = '22023';
    end if;
    tie_key := (p_score * 2)::integer::text || ':' || array_to_string(expected_ids, ',');
    select coalesce(tie_breaks->p_scope, '{}'::jsonb) into scope_choices
    from public.contests where id = p_contest_id;
    if p_reset then
        scope_choices := scope_choices - tie_key;
    else
        scope_choices := scope_choices || jsonb_build_object(tie_key, to_jsonb(p_entry_ids));
    end if;
    update public.contests
    set tie_breaks = jsonb_set(tie_breaks, array[p_scope], scope_choices, true)
    where id = p_contest_id;
end;
$$;

revoke all on function public.resolve_podium_tie(uuid, text, numeric, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.resolve_podium_tie(uuid, text, numeric, uuid[], boolean) to authenticated;

commit;
