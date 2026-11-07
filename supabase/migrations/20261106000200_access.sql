begin;

grant usage on schema public to anon, authenticated;
grant select on public.contests, public.voters, public.entries, public.ratings to anon, authenticated;
grant select on public.approved_editors to authenticated;
grant update (value) on public.ratings to authenticated;

create policy public_contests on public.contests for select to anon, authenticated using (true);
create policy public_voters on public.voters for select to anon, authenticated using (true);
create policy public_entries on public.entries for select to anon, authenticated using (true);
create policy public_ratings on public.ratings for select to anon, authenticated using (true);

create policy own_membership on public.approved_editors for select to authenticated
using (user_id = (select auth.uid()));

create policy editor_rating_values on public.ratings for update to authenticated
using (exists (select 1 from public.approved_editors where user_id = (select auth.uid())))
with check (exists (select 1 from public.approved_editors where user_id = (select auth.uid())));

-- No client INSERT/DELETE, structure-write, or approval-write policies/grants.
-- Provision approvals only through the database owner in Dashboard SQL.
commit;
