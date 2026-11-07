begin;

-- The only client path for changing voter columns. Ordinary table writes stay denied.
create function public.manage_voter(
    p_contest_id uuid,
    p_action text,
    p_voter_id uuid default null,
    p_name text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
    voter_uuid uuid;
    clean_name text;
begin
    -- Hold membership through the transaction so owner revocation cannot race it.
    perform 1 from public.approved_editors where user_id = auth.uid() for share;
    if not found then
        raise exception 'Editor approval required' using errcode = '42501';
    end if;
    if p_action is null or p_action not in ('add', 'rename', 'delete') then
        raise exception 'Invalid action' using errcode = '22023';
    end if;

    -- Serialize structural changes for this year, including position allocation.
    perform 1 from public.contests where id = p_contest_id for no key update;
    if not found then
        raise exception 'Contest not found' using errcode = 'P0002';
    end if;

    if p_action in ('add', 'rename') then
        clean_name := regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g');
        if clean_name is null or char_length(clean_name) not between 1 and 80 then
            raise exception 'Name must contain 1 to 80 characters' using errcode = '22023';
        end if;
    end if;

    if p_action = 'add' then
        -- The dialog retains this ID across retries after an ambiguous network error.
        voter_uuid := coalesce(p_voter_id, gen_random_uuid());
        if exists (select 1 from public.voters where id = voter_uuid) then
            if not exists (select 1 from public.voters where id = voter_uuid and contest_id = p_contest_id) then
                raise exception 'Voter identity belongs to another contest' using errcode = '22023';
            end if;
            return voter_uuid;
        end if;
        insert into public.voters (id, contest_id, key, name, position)
        select voter_uuid, p_contest_id, 'person_' || replace(voter_uuid::text, '-', ''),
               clean_name, coalesce(max(position), 0) + 1
        from public.voters where contest_id = p_contest_id;
        insert into public.ratings (contest_id, entry_id, voter_id, value)
        select p_contest_id, id, voter_uuid, null
        from public.entries where contest_id = p_contest_id;
    else
        select id into voter_uuid from public.voters
        where id = p_voter_id and contest_id = p_contest_id;
        if not found then
            raise exception 'Voter not found in contest' using errcode = 'P0002';
        end if;
        if p_action = 'rename' then
            update public.voters set name = clean_name where id = voter_uuid;
        else
            delete from public.ratings where voter_id = voter_uuid and contest_id = p_contest_id;
            delete from public.voters where id = voter_uuid and contest_id = p_contest_id;
        end if;
    end if;

    -- One published contest UPDATE tells all viewers to fetch the atomic structure.
    -- No auth data or broad table-write privileges are exposed to the client.
    update public.contests set title = title where id = p_contest_id;
    return voter_uuid;
end;
$$;

revoke all on function public.manage_voter(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.manage_voter(uuid, text, uuid, text) to authenticated;

commit;
