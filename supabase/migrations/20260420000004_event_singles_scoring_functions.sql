-- VirWave Singles Group — scoring functions
-- Handoff: tasks/singles-group-april-2026/README.md
--
-- Four core functions, all SECURITY DEFINER with locked search_path:
--
--   pairwise_score(event_id, user_a, user_b) -> numeric (0..100) | null
--   meeting_fit(event_id, user_a, user_b)    -> numeric (0..100) | null
--   final_score(event_id, user_a, user_b)    -> numeric (0..100) | null
--   compute_event_shortlists(event_id)       -> int (rows written)
--
-- Plus host aggregates:
--
--   event_cohesion_score(event_id)           -> numeric
--   event_realm_distribution(event_id)       -> table (realm text, n int)
--
-- Pair math is cached in event_singles_pair_scores during orchestration.
-- Raw event_answers are never exposed; all callers hit these functions.


-- =============================================================
-- pairwise_score
-- =============================================================
-- weighted average of per-question scores, weighted by dimension.
-- question_score = 100 * (1 - |ord_a - ord_b| / 3) on 0..3 ordinal scale.
-- Returns null if fewer than min_answered shared answers (default 7).

create or replace function pairwise_score(
  p_event_id uuid,
  p_user_a   uuid,
  p_user_b   uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_min_answered int;
  v_shared       int;
  v_score        numeric;
begin
  select coalesce(c.min_answered, 7) into v_min_answered
  from event_singles_config c where c.event_id = p_event_id;

  v_min_answered := coalesce(v_min_answered, 7);

  with shared as (
    select
      q.id           as question_id,
      q.dimension,
      (a.value)::int as ord_a,
      (b.value)::int as ord_b
    from event_singles_questions q
    join event_answers a
      on a.event_id = p_event_id and a.user_id = p_user_a and a.question_slug = q.id
    join event_answers b
      on b.event_id = p_event_id and b.user_id = p_user_b and b.question_slug = q.id
    where q.active
      and a.value ~ '^[0-3]$'
      and b.value ~ '^[0-3]$'
  )
  select count(*)::int,
         sum(w.weight * (100.0 * (1.0 - abs(s.ord_a - s.ord_b) / 3.0)))
         / nullif(sum(w.weight), 0)
    into v_shared, v_score
  from shared s
  join event_singles_dimension_weights w on w.dimension = s.dimension;

  if v_shared is null or v_shared < v_min_answered then
    return null;
  end if;

  return round(greatest(0, least(100, v_score))::numeric, 2);
end;
$$;

revoke all on function pairwise_score(uuid, uuid, uuid) from public;


-- =============================================================
-- meeting_fit
-- =============================================================
-- Averages the two directional matrix rows for (realm_a, realm_b) and
-- (realm_b, realm_a), then applies 0.55*res + 0.25*growth - 0.20*friction.
-- Null if either participant has no realm set, or the realm pair isn't in
-- the matrix.

create or replace function meeting_fit(
  p_event_id uuid,
  p_user_a   uuid,
  p_user_b   uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_realm_a text;
  v_realm_b text;
  v_res     numeric;
  v_fri     numeric;
  v_gro     numeric;
  v_score   numeric;
begin
  select archetype_realm into v_realm_a
  from event_participants where event_id = p_event_id and user_id = p_user_a;

  select archetype_realm into v_realm_b
  from event_participants where event_id = p_event_id and user_id = p_user_b;

  if v_realm_a is null or v_realm_b is null then
    return null;
  end if;

  select
    avg(resonance), avg(friction), avg(growth)
    into v_res, v_fri, v_gro
  from event_singles_realm_matrix
  where (realm_a = v_realm_a and realm_b = v_realm_b)
     or (realm_a = v_realm_b and realm_b = v_realm_a);

  if v_res is null then
    return null;
  end if;

  v_score := 0.55 * v_res + 0.25 * v_gro - 0.20 * v_fri;
  return round(greatest(0, least(100, v_score))::numeric, 2);
end;
$$;

revoke all on function meeting_fit(uuid, uuid, uuid) from public;


-- =============================================================
-- final_score
-- =============================================================
-- 0.65*pairwise + 0.35*meeting_fit. -8 when both answered em_02 and
-- the gap is >= 2 (EQ-mismatch overlay, Master Synthesis §6.5).
-- Clamped 0..100. Null if pairwise_score is null.

create or replace function final_score(
  p_event_id uuid,
  p_user_a   uuid,
  p_user_b   uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_pw       numeric;
  v_mf       numeric;
  v_eq_a     int;
  v_eq_b     int;
  v_score    numeric;
begin
  v_pw := pairwise_score(p_event_id, p_user_a, p_user_b);
  if v_pw is null then
    return null;
  end if;

  v_mf := meeting_fit(p_event_id, p_user_a, p_user_b);

  if v_mf is null then
    v_score := v_pw;
  else
    v_score := 0.65 * v_pw + 0.35 * v_mf;
  end if;

  select (value)::int into v_eq_a
  from event_answers
  where event_id = p_event_id and user_id = p_user_a
    and question_slug = 'em_02' and value ~ '^[0-3]$';

  select (value)::int into v_eq_b
  from event_answers
  where event_id = p_event_id and user_id = p_user_b
    and question_slug = 'em_02' and value ~ '^[0-3]$';

  if v_eq_a is not null and v_eq_b is not null and abs(v_eq_a - v_eq_b) >= 2 then
    v_score := v_score - 8;
  end if;

  return round(greatest(0, least(100, v_score))::numeric, 2);
end;
$$;

revoke all on function final_score(uuid, uuid, uuid) from public;


-- =============================================================
-- _singles_framing_for
-- =============================================================
-- Internal: picks a framing line for a pair by comparing answered
-- dimensions. Returns a single line (or null). Kept small in v1.

create or replace function _singles_framing_for(
  p_event_id uuid,
  p_user_a   uuid,
  p_user_b   uuid
)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_dimension text;
  v_match     boolean;
  v_axis      text;
  v_line      text;
begin
  -- Find the most divergent dimension, break ties by lowest weight.
  select dim, (avg_dist <= 0.7)
    into v_dimension, v_match
  from (
    select q.dimension as dim,
           avg(abs((a.value)::int - (b.value)::int)::numeric) as avg_dist,
           min(w.weight) as w
    from event_singles_questions q
    join event_answers a
      on a.event_id = p_event_id and a.user_id = p_user_a and a.question_slug = q.id
    join event_answers b
      on b.event_id = p_event_id and b.user_id = p_user_b and b.question_slug = q.id
    join event_singles_dimension_weights w on w.dimension = q.dimension
    where a.value ~ '^[0-3]$' and b.value ~ '^[0-3]$'
    group by q.dimension
  ) s
  order by s.avg_dist desc, s.w asc
  limit 1;

  if v_dimension is null then
    return null;
  end if;

  v_axis := case when v_match then 'high_' else 'low_' end
            || v_dimension || '_match';

  select line into v_line
  from event_singles_framing_bank
  where axis_profile = v_axis and active
  order by random()
  limit 1;

  return v_line;
end;
$$;

revoke all on function _singles_framing_for(uuid, uuid, uuid) from public;


-- =============================================================
-- compute_event_shortlists
-- =============================================================
-- 1. Recompute pair_scores for every unordered pair of participants.
-- 2. For each participant: top 3 by final_score + 1 growth stretch + 1
--    same-realm familiar pick. Dedup if picks overlap (shortlist_size
--    caps total — default 5).
-- 3. show_score = (final_score >= reveal_threshold).
-- 4. Framing line attached per row via _singles_framing_for.
-- Returns the total number of shortlist rows written.

create or replace function compute_event_shortlists(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reveal   int;
  v_size     int;
  v_written  int := 0;
  r          record;
  v_participant uuid;
  v_rank     int;
  v_picks    uuid[];
  v_pick     record;
  v_realm    text;
begin
  if not exists (select 1 from events where id = p_event_id) then
    raise exception 'event_not_found';
  end if;

  select coalesce(reveal_threshold, 85), coalesce(shortlist_size, 5)
    into v_reveal, v_size
  from event_singles_config where event_id = p_event_id;

  v_reveal := coalesce(v_reveal, 85);
  v_size   := coalesce(v_size,   5);

  -- 1. Cache pair math.
  delete from event_singles_pair_scores where event_id = p_event_id;

  insert into event_singles_pair_scores
    (event_id, user_a, user_b, pairwise_score, meeting_fit, final_score, answered_shared)
  select
    p_event_id,
    least(pa.user_id, pb.user_id),
    greatest(pa.user_id, pb.user_id),
    pairwise_score(p_event_id, pa.user_id, pb.user_id),
    meeting_fit(p_event_id, pa.user_id, pb.user_id),
    final_score(p_event_id, pa.user_id, pb.user_id),
    (select count(*) from event_answers a
       join event_answers b
         on b.event_id = a.event_id and b.question_slug = a.question_slug
       join event_singles_questions q on q.id = a.question_slug
      where a.event_id = p_event_id
        and a.user_id = pa.user_id
        and b.user_id = pb.user_id
        and a.value ~ '^[0-3]$' and b.value ~ '^[0-3]$')
  from event_participants pa
  join event_participants pb
    on pb.event_id = pa.event_id and pb.user_id > pa.user_id
  where pa.event_id = p_event_id;

  -- 2. Build each participant's shortlist.
  delete from event_singles_shortlist where event_id = p_event_id;

  for v_participant in
    select user_id from event_participants where event_id = p_event_id
  loop
    v_picks := array[]::uuid[];
    v_rank  := 0;

    select archetype_realm into v_realm
    from event_participants where event_id = p_event_id and user_id = v_participant;

    -- Top 3 by final_score
    for v_pick in
      select other_id, final_score
      from (
        select case when user_a = v_participant then user_b else user_a end as other_id,
               final_score
        from event_singles_pair_scores
        where event_id = p_event_id
          and (user_a = v_participant or user_b = v_participant)
          and final_score is not null
      ) t
      order by final_score desc
      limit 3
    loop
      v_rank := v_rank + 1;
      insert into event_singles_shortlist
        (event_id, participant_id, rank, other_id, pick_type, final_score, show_score, framing)
      values (
        p_event_id, v_participant, v_rank, v_pick.other_id, 'top', v_pick.final_score,
        v_pick.final_score >= v_reveal,
        _singles_framing_for(p_event_id, v_participant, v_pick.other_id)
      );
      v_picks := array_append(v_picks, v_pick.other_id);
      exit when v_rank >= v_size;
    end loop;

    -- +1 Growth stretch pick: highest realm-matrix growth among remaining.
    if v_rank < v_size then
      select t.other_id, t.final_score into v_pick
      from (
        select case when ps.user_a = v_participant then ps.user_b else ps.user_a end as other_id,
               ps.final_score
        from event_singles_pair_scores ps
        where ps.event_id = p_event_id
          and (ps.user_a = v_participant or ps.user_b = v_participant)
          and ps.final_score is not null
      ) t
      join event_participants op on op.event_id = p_event_id and op.user_id = t.other_id
      left join event_singles_realm_matrix m
        on (m.realm_a = v_realm and m.realm_b = op.archetype_realm)
      where t.other_id <> all(v_picks)
      order by m.growth desc nulls last, t.final_score desc
      limit 1;

      if v_pick.other_id is not null then
        v_rank := v_rank + 1;
        insert into event_singles_shortlist
          (event_id, participant_id, rank, other_id, pick_type, final_score, show_score, framing)
        values (
          p_event_id, v_participant, v_rank, v_pick.other_id, 'growth', v_pick.final_score,
          v_pick.final_score >= v_reveal,
          _singles_framing_for(p_event_id, v_participant, v_pick.other_id)
        );
        v_picks := array_append(v_picks, v_pick.other_id);
      end if;
    end if;

    -- +1 Familiar pick: same realm, highest pairwise among remaining.
    if v_rank < v_size and v_realm is not null then
      select t.other_id, t.final_score into v_pick
      from (
        select case when ps.user_a = v_participant then ps.user_b else ps.user_a end as other_id,
               ps.pairwise_score,
               ps.final_score
        from event_singles_pair_scores ps
        where ps.event_id = p_event_id
          and (ps.user_a = v_participant or ps.user_b = v_participant)
          and ps.final_score is not null
      ) t
      join event_participants op on op.event_id = p_event_id and op.user_id = t.other_id
      where t.other_id <> all(v_picks)
        and op.archetype_realm = v_realm
      order by t.pairwise_score desc nulls last
      limit 1;

      if v_pick.other_id is not null then
        v_rank := v_rank + 1;
        insert into event_singles_shortlist
          (event_id, participant_id, rank, other_id, pick_type, final_score, show_score, framing)
        values (
          p_event_id, v_participant, v_rank, v_pick.other_id, 'familiar', v_pick.final_score,
          v_pick.final_score >= v_reveal,
          _singles_framing_for(p_event_id, v_participant, v_pick.other_id)
        );
        v_picks := array_append(v_picks, v_pick.other_id);
      end if;
    end if;

    v_written := v_written + v_rank;
  end loop;

  return v_written;
end;
$$;

revoke all on function compute_event_shortlists(uuid) from public;


-- =============================================================
-- event_cohesion_score — host aggregate
-- =============================================================
-- Mean final_score across all scored pairs in the event. Null when there
-- are no scored pairs yet. Host-only via explicit authz check.

create or replace function event_cohesion_score(p_event_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_score numeric;
begin
  if not exists (
    select 1 from events where id = p_event_id and host_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  select round(avg(final_score)::numeric, 2) into v_score
  from event_singles_pair_scores
  where event_id = p_event_id and final_score is not null;

  return v_score;
end;
$$;

revoke all on function event_cohesion_score(uuid) from public;
grant execute on function event_cohesion_score(uuid) to authenticated;


-- =============================================================
-- event_realm_distribution — host aggregate
-- =============================================================
-- Count of participants per realm. Host-only. 'unassigned' for nulls.

create or replace function event_realm_distribution(p_event_id uuid)
returns table (realm text, n int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from events where id = p_event_id and host_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  return query
  select coalesce(archetype_realm, 'unassigned') as realm, count(*)::int as n
  from event_participants
  where event_id = p_event_id
  group by coalesce(archetype_realm, 'unassigned')
  order by n desc;
end;
$$;

revoke all on function event_realm_distribution(uuid) from public;
grant execute on function event_realm_distribution(uuid) to authenticated;


-- =============================================================
-- Who can call what
-- =============================================================
-- pairwise/meeting_fit/final_score/compute_event_shortlists are called
-- from the edge function under service_role. Keep them revoked from
-- authenticated so clients can't poke at raw scores directly.
