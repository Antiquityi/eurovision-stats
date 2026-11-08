begin;

alter table public.entries add column artist_song text not null default ''
    check (char_length(artist_song) <= 200);

-- Approved editors can change only this field through the RPC.
create function public.set_entry_details(p_contest_id uuid, p_entry_id uuid, p_artist_song text)
returns text language plpgsql security definer set search_path = '' as $$
declare
    clean_text text;
begin
    perform 1 from public.approved_editors where user_id = auth.uid() for share;
    if not found then
        raise exception 'Editor approval required' using errcode = '42501';
    end if;
    clean_text := regexp_replace(p_artist_song, '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if clean_text is null or char_length(clean_text) > 200 then
        raise exception 'Use at most 200 characters' using errcode = '22023';
    end if;
    perform 1 from public.contests where id = p_contest_id for no key update;
    if not found then
        raise exception 'Contest not found' using errcode = 'P0002';
    end if;
    update public.entries set artist_song = clean_text
    where id = p_entry_id and contest_id = p_contest_id;
    if not found then
        raise exception 'Entry not found in contest' using errcode = 'P0002';
    end if;
    -- Reuse the published contest event to refresh every viewer's snapshot.
    update public.contests set title = title where id = p_contest_id;
    return clean_text;
end;
$$;

revoke all on function public.set_entry_details(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_entry_details(uuid, uuid, text) to authenticated;

commit;
