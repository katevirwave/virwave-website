-- Rename archetype_family → archetype_realm.
--
-- Postgres won't let us rename a column while dependent views/functions
-- reference it, so we drop and recreate those around the rename.


-- =============================================================
-- Drop dependents
-- =============================================================

drop function if exists host_room_summary(uuid);
drop view    if exists event_participants_public;


-- =============================================================
-- Rename
-- =============================================================

alter table event_participants
  rename column archetype_family to archetype_realm;


-- =============================================================
-- Recreate view with new column name
-- =============================================================

create view event_participants_public
with (security_invoker = off) as
select p.event_id, p.user_id, p.first_name, p.archetype_realm
from event_participants p
where exists (
  select 1 from event_participants me
  where me.event_id = p.event_id
    and me.user_id  = auth.uid()
);

grant select on event_participants_public to authenticated;


-- =============================================================
-- Recreate host_room_summary with `realms` key
-- =============================================================

create or replace function host_room_summary(p_event_id uuid)
returns table (
  total_participants int,
  realms jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from events where id = p_event_id and host_id = auth.uid()) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    (select count(*)::int from event_participants where event_id = p_event_id),
    coalesce(
      (select jsonb_object_agg(realm, cnt) from (
         select coalesce(archetype_realm, 'unassigned') as realm, count(*) as cnt
         from event_participants
         where event_id = p_event_id
         group by archetype_realm
      ) s),
      '{}'::jsonb
    );
end;
$$;

revoke all on function host_room_summary(uuid) from public;
grant execute on function host_room_summary(uuid) to authenticated;
