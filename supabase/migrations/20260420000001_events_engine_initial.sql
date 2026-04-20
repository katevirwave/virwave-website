-- VirWave Events Engine — initial schema + RLS
--
-- Decisions (see /root/.claude/plans/spicy-scribbling-harp.md):
--   - Hosts always see pairs (no N-floor). Privacy = rank_bucket only, never raw scores.
--   - event_answers deleted 7 days after event ends (pg_cron).
--   - Opt-out default: answers merge into portrait unless opt_in_portrait = false.
--   - v1: manual match-push by host. Realtime (v2) slots in via a trigger later.
--
-- Security model:
--   - event_answers: owner-only, no exceptions (not even host, not even other participants).
--   - event_matches / event_table_assignments: revealed_at gates client read.
--   - Host UI talks to SECURITY DEFINER functions only, never SELECTs on answers.
--   - Matching engine runs as service_role inside a Supabase Edge Function.


-- =============================================================
-- Extensions
-- =============================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()


-- =============================================================
-- Enums
-- =============================================================

create type event_mode   as enum ('tables', 'pairs');
create type event_status as enum ('draft', 'upcoming', 'live', 'ended', 'archived');
create type event_kind   as enum ('talk', 'fair', 'workshop', 'mixer', 'dinner', 'networking');
create type rank_bucket  as enum ('strong', 'good', 'ok');


-- =============================================================
-- Tables
-- =============================================================

create table events (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  title           text not null,
  subtitle        text,
  host_id         uuid not null references auth.users(id) on delete restrict,
  mode            event_mode not null,
  kind            event_kind not null,
  status          event_status not null default 'draft',
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  venue           text,
  city            text,
  country         text,
  capacity        int check (capacity > 0),
  blurb           text,
  cover_image_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index events_status_starts_at_idx on events (status, starts_at);
create index events_host_id_idx           on events (host_id);


create table event_questions (
  id         uuid primary key default gen_random_uuid(),
  version    int  not null,
  slug       text not null,
  prompt     text not null,
  options    jsonb not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (version, slug)
);

create index event_questions_active_idx on event_questions (active, version);


create table event_participants (
  event_id         uuid not null references events(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  first_name       text not null check (length(first_name) between 1 and 40),
  archetype_family text,
  opt_in_portrait  boolean not null default true,
  joined_at        timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_participants_event_idx on event_participants (event_id);


create table event_answers (
  event_id         uuid not null references events(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  question_slug    text not null,
  question_version int  not null,
  value            text not null,
  answered_at      timestamptz not null default now(),
  primary key (event_id, user_id, question_slug)
);

create index event_answers_event_idx on event_answers (event_id);


create table event_matches (
  event_id    uuid not null references events(id) on delete cascade,
  user_a      uuid not null references auth.users(id) on delete cascade,
  user_b      uuid not null references auth.users(id) on delete cascade,
  rank_bucket rank_bucket not null,
  revealed_at timestamptz,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_a, user_b),
  check (user_a < user_b)
);

create index event_matches_event_idx  on event_matches (event_id);
create index event_matches_user_a_idx on event_matches (user_a, event_id);
create index event_matches_user_b_idx on event_matches (user_b, event_id);


create table event_table_assignments (
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  table_no    int  not null check (table_no > 0),
  revealed_at timestamptz,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_table_assignments_event_idx on event_table_assignments (event_id);


-- =============================================================
-- RLS: enable
-- =============================================================

alter table events                  enable row level security;
alter table event_questions         enable row level security;
alter table event_participants      enable row level security;
alter table event_answers           enable row level security;
alter table event_matches           enable row level security;
alter table event_table_assignments enable row level security;


-- =============================================================
-- RLS: events
-- =============================================================

create policy events_public_read on events
  for select using (status in ('upcoming', 'live', 'ended', 'archived'));

create policy events_host_read_own on events
  for select using (auth.uid() = host_id);

create policy events_host_write on events
  for all using (auth.uid() = host_id)
  with check (auth.uid() = host_id);


-- =============================================================
-- RLS: event_questions
-- =============================================================

create policy event_questions_public_read on event_questions
  for select using (active = true);
-- Writes: service_role only (bypasses RLS).


-- =============================================================
-- RLS: event_participants
-- =============================================================
-- Participants join via join_event() (SECURITY DEFINER), not direct INSERT.
-- Others in the same event see name + family via the event_participants_public view.

create policy event_participants_self_read on event_participants
  for select using (auth.uid() = user_id);

create policy event_participants_self_update on event_participants
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- No INSERT or DELETE policy: only SECURITY DEFINER functions touch these.


-- =============================================================
-- RLS: event_answers (owner-only, no exceptions)
-- =============================================================

create policy event_answers_self_read on event_answers
  for select using (auth.uid() = user_id);

create policy event_answers_self_insert on event_answers
  for insert with check (auth.uid() = user_id);

create policy event_answers_self_update on event_answers
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- No DELETE policy: cleanup_old_event_answers() (service_role) is the only deleter.


-- =============================================================
-- RLS: event_matches (self-only, revealed only)
-- =============================================================

create policy event_matches_self_read on event_matches
  for select using (
    revealed_at is not null
    and (auth.uid() = user_a or auth.uid() = user_b)
  );
-- Writes: service_role only.


-- =============================================================
-- RLS: event_table_assignments (self-only, revealed only)
-- =============================================================

create policy event_table_assignments_self_read on event_table_assignments
  for select using (
    revealed_at is not null
    and auth.uid() = user_id
  );
-- Writes: service_role only.


-- =============================================================
-- View: event_participants_public (name + family only)
-- =============================================================
-- Scoped to participants of the same event as the caller.

create view event_participants_public
with (security_invoker = off) as
select p.event_id, p.user_id, p.first_name, p.archetype_family
from event_participants p
where exists (
  select 1 from event_participants me
  where me.event_id = p.event_id
    and me.user_id  = auth.uid()
);

grant select on event_participants_public to authenticated;


-- =============================================================
-- Function: join_event (SECURITY DEFINER)
-- =============================================================

create or replace function join_event(
  p_event_id        uuid,
  p_first_name      text,
  p_opt_in_portrait boolean default true
)
returns event_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events%rowtype;
  v_count int;
  v_row   event_participants%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'event_not_found';
  end if;

  if v_event.status not in ('upcoming', 'live') then
    raise exception 'event_closed';
  end if;

  if v_event.capacity is not null then
    select count(*) into v_count from event_participants where event_id = p_event_id;
    if v_count >= v_event.capacity
       and not exists (select 1 from event_participants
                       where event_id = p_event_id and user_id = auth.uid()) then
      raise exception 'event_full';
    end if;
  end if;

  insert into event_participants (event_id, user_id, first_name, opt_in_portrait)
  values (p_event_id, auth.uid(), p_first_name, p_opt_in_portrait)
  on conflict (event_id, user_id) do update
    set first_name      = excluded.first_name,
        opt_in_portrait = excluded.opt_in_portrait
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function join_event(uuid, text, boolean) from public;
grant execute on function join_event(uuid, text, boolean) to authenticated;


-- =============================================================
-- Function: host_room_summary (SECURITY DEFINER)
-- =============================================================

create or replace function host_room_summary(p_event_id uuid)
returns table (
  total_participants int,
  families jsonb
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
      (select jsonb_object_agg(fam, cnt) from (
         select coalesce(archetype_family, 'unassigned') as fam, count(*) as cnt
         from event_participants
         where event_id = p_event_id
         group by archetype_family
      ) s),
      '{}'::jsonb
    );
end;
$$;

revoke all on function host_room_summary(uuid) from public;
grant execute on function host_room_summary(uuid) to authenticated;


-- =============================================================
-- Function: host_top_pairs (SECURITY DEFINER)
-- =============================================================

create or replace function host_top_pairs(p_event_id uuid)
returns table (
  user_a      uuid,
  user_b      uuid,
  name_a      text,
  name_b      text,
  rank_bucket rank_bucket
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
    m.user_a, m.user_b,
    pa.first_name, pb.first_name,
    m.rank_bucket
  from event_matches m
  join event_participants pa on pa.event_id = m.event_id and pa.user_id = m.user_a
  join event_participants pb on pb.event_id = m.event_id and pb.user_id = m.user_b
  where m.event_id = p_event_id
  order by case m.rank_bucket when 'strong' then 1 when 'good' then 2 else 3 end,
           pa.first_name;
end;
$$;

revoke all on function host_top_pairs(uuid) from public;
grant execute on function host_top_pairs(uuid) to authenticated;


-- =============================================================
-- Function: host_table_roster (SECURITY DEFINER)
-- =============================================================

create or replace function host_table_roster(p_event_id uuid)
returns table (
  user_id    uuid,
  first_name text,
  table_no   int
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
  select p.user_id, p.first_name, a.table_no
  from event_participants p
  left join event_table_assignments a
    on a.event_id = p.event_id and a.user_id = p.user_id
  where p.event_id = p_event_id
  order by a.table_no nulls last, p.first_name;
end;
$$;

revoke all on function host_table_roster(uuid) from public;
grant execute on function host_table_roster(uuid) to authenticated;


-- =============================================================
-- Function: cleanup_old_event_answers (pg_cron target)
-- =============================================================

create or replace function cleanup_old_event_answers()
returns void
language sql
security definer
set search_path = public
as $$
  delete from event_answers a
  using events e
  where a.event_id = e.id
    and e.ends_at is not null
    and e.ends_at < now() - interval '7 days';
$$;

revoke all on function cleanup_old_event_answers() from public;
-- Schedule (run once after enabling pg_cron):
--   create extension if not exists pg_cron;
--   select cron.schedule('cleanup_event_answers_daily', '0 3 * * *',
--                        $$ select cleanup_old_event_answers() $$);


-- =============================================================
-- Trigger: events.updated_at
-- =============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
before update on events
for each row execute function set_updated_at();
