-- Rename archetype_family -> archetype_realm (copy/terminology alignment).
-- Safe to run because no client code reads this column yet.

alter table event_participants rename column archetype_family to archetype_realm;

-- View recreates because the column it exposes was renamed.
drop view if exists event_participants_public;

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

-- host_room_summary returns a column named `families` which is now `realms`.
-- Return-type changes require DROP + CREATE (CREATE OR REPLACE can't alter
-- the output signature).
drop function if exists host_room_summary(uuid);

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
