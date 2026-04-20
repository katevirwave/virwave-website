-- =============================================================================
-- VirWave — Singles Group Scoring
-- Migration 04: Postgres scoring functions
-- =============================================================================
-- Run AFTER 03_singles_scoring_schema.sql.
-- Retargeted to this repo's schema:
--   event_participants.archetype_realm (not .family)
--   event_answers.question_slug / value text (cast ::int for math)
--   events.host_id (not host_user_id)
--   event_participants.id uuid (surrogate key added in migration 03)
-- Bug fixed: GET DIAGNOSTICS row_count assigned to boolean var in original.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- pairwise_score
-- Joins through event_participants.id → (event_id, user_id) to reach
-- event_answers, since event_answers has no participant_id FK.
-- event_answers.value is text storing '1'–'4'; cast to int for arithmetic.
-- question_slug matches events_singles_questions.id (e.g. 'vb_01').
-- -----------------------------------------------------------------------------
create or replace function pairwise_score(
  p_a_id uuid,
  p_b_id uuid,
  p_min_answered int default 7
)
returns numeric
language sql
stable
as $$
  with
  a_ids as (
    select event_id, user_id from event_participants where id = p_a_id
  ),
  b_ids as (
    select event_id, user_id from event_participants where id = p_b_id
  ),
  shared as (
    select
      a.question_slug,
      a.value::int as a_value,
      b.value::int as b_value,
      q.dimension,
      w.weight
    from event_answers a
    join a_ids on a_ids.event_id = a.event_id and a_ids.user_id = a.user_id
    join event_answers b on b.question_slug = a.question_slug
    join b_ids on b_ids.event_id = b.event_id and b_ids.user_id = b.user_id
    join events_singles_questions q on q.id = a.question_slug
    join events_singles_dimension_weights w on w.dimension = q.dimension
  ),
  scored as (
    select
      weight,
      100.0 * (1.0 - (abs(a_value - b_value)::numeric / 3.0)) as q_score
    from shared
  ),
  agg as (
    select
      count(*) as n,
      sum(q_score * weight) as numerator,
      sum(weight) as denominator
    from scored
  )
  select case
    when n < p_min_answered then null
    when denominator = 0 then null
    else round(numerator / denominator, 2)
  end
  from agg;
$$;

comment on function pairwise_score is
  '10-question weighted compatibility, 0-100. NULL if not enough shared answers.';

-- -----------------------------------------------------------------------------
-- meeting_fit
-- Reads event_participants.archetype_realm (this repo's column name).
-- -----------------------------------------------------------------------------
create or replace function meeting_fit(
  p_a_id uuid,
  p_b_id uuid
)
returns numeric
language sql
stable
as $$
  with families as (
    select
      (select archetype_realm from event_participants where id = p_a_id) as a_family,
      (select archetype_realm from event_participants where id = p_b_id) as b_family
  ),
  combined as (
    select
      avg(m.resonance)::numeric as resonance,
      avg(m.friction)::numeric  as friction,
      avg(m.growth)::numeric    as growth
    from families f
    join events_singles_family_matrix m
      on (m.viewer_family = f.a_family and m.subject_family = f.b_family)
      or (m.viewer_family = f.b_family and m.subject_family = f.a_family)
  )
  select case
    when (select a_family from families) is null
      or (select b_family from families) is null
    then null
    else round(0.55 * resonance + 0.25 * growth - 0.20 * friction, 2)
  end
  from combined;
$$;

comment on function meeting_fit is
  'Realm-compatibility composite, ~25-95 in practice. NULL if either realm unset.';

-- -----------------------------------------------------------------------------
-- final_score
-- EQ-mismatch check joins event_answers via event_participants.id.
-- -----------------------------------------------------------------------------
create or replace function final_score(
  p_a_id uuid,
  p_b_id uuid,
  p_min_answered int default 7
)
returns numeric
language plpgsql
stable
as $$
declare
  v_pair    numeric;
  v_meeting numeric;
  v_eq_a    int;
  v_eq_b    int;
  v_score   numeric;
begin
  v_pair    := pairwise_score(p_a_id, p_b_id, p_min_answered);
  v_meeting := meeting_fit(p_a_id, p_b_id);

  if v_pair is null or v_meeting is null then
    return null;
  end if;

  v_score := 0.65 * v_pair + 0.35 * v_meeting;

  select ea.value::int into v_eq_a
  from event_answers ea
  join event_participants pa on pa.event_id = ea.event_id and pa.user_id = ea.user_id
  where pa.id = p_a_id and ea.question_slug = 'em_02'
  limit 1;

  select ea.value::int into v_eq_b
  from event_answers ea
  join event_participants pa on pa.event_id = ea.event_id and pa.user_id = ea.user_id
  where pa.id = p_b_id and ea.question_slug = 'em_02'
  limit 1;

  if v_eq_a is not null and v_eq_b is not null and abs(v_eq_a - v_eq_b) >= 2 then
    v_score := v_score - 8;
  end if;

  return greatest(0, least(100, round(v_score, 2)));
end;
$$;

comment on function final_score is
  'Headline score for one pair, 0-100. Combines pairwise + meeting_fit with EQ penalty.';

-- -----------------------------------------------------------------------------
-- pick_framing_line
-- -----------------------------------------------------------------------------
create or replace function pick_framing_line(
  p_a_id uuid,
  p_b_id uuid
)
returns text
language plpgsql
stable
as $$
declare
  v_resonance numeric;
  v_friction  numeric;
  v_growth    numeric;
  v_a_family  text;
  v_b_family  text;
  v_key       text;
  v_line      text;
begin
  select archetype_realm into v_a_family from event_participants where id = p_a_id;
  select archetype_realm into v_b_family from event_participants where id = p_b_id;

  select avg(m.resonance), avg(m.friction), avg(m.growth)
    into v_resonance, v_friction, v_growth
  from events_singles_family_matrix m
  where (m.viewer_family = v_a_family and m.subject_family = v_b_family)
     or (m.viewer_family = v_b_family and m.subject_family = v_a_family);

  v_key := case
    when v_resonance >= 75 and v_growth < 50              then 'high_res_low_growth'
    when v_resonance >= 75 and v_growth >= 75             then 'high_res_high_growth'
    when v_resonance between 50 and 74 and v_growth >= 75 then 'mid_res_high_growth'
    when v_resonance < 50 and v_growth >= 75              then 'low_res_high_growth'
    when v_friction >= 65 and v_growth >= 75              then 'high_friction_high_growth'
    when v_friction >= 65 and v_growth < 50               then 'high_friction_low_growth'
    else 'balanced'
  end;

  select framing_line into v_line from events_singles_framing_bank where profile_key = v_key;
  return coalesce(v_line, 'A connection worth meeting.');
end;
$$;

-- -----------------------------------------------------------------------------
-- shared_top_answer_prompt
-- Joins through event_participants.id to event_answers.
-- -----------------------------------------------------------------------------
create or replace function shared_top_answer_prompt(
  p_a_id uuid,
  p_b_id uuid
)
returns text
language sql
stable
as $$
  with
  a_ids as (
    select event_id, user_id from event_participants where id = p_a_id
  ),
  b_ids as (
    select event_id, user_id from event_participants where id = p_b_id
  ),
  shared_exact as (
    select q.text, q.dimension, w.weight
    from event_answers a
    join a_ids on a_ids.event_id = a.event_id and a_ids.user_id = a.user_id
    join event_answers b
      on b.question_slug = a.question_slug
     and b.value = a.value
    join b_ids on b_ids.event_id = b.event_id and b_ids.user_id = b.user_id
    join events_singles_questions q on q.id = a.question_slug
    join events_singles_dimension_weights w on w.dimension = q.dimension
    order by w.weight desc, q.day_number asc
    limit 1
  )
  select 'You both answered the same way to: "' || text || '" — ask them why.'
  from shared_exact;
$$;

-- -----------------------------------------------------------------------------
-- compute_event_shortlists
-- Orchestrator. SECURITY DEFINER — called by edge function via service role.
-- Uses event_participants.archetype_realm (aliased as family in the loop
-- cursor so inner CTEs can reference v_participant.family unchanged).
-- Bug fix from original: GET DIAGNOSTICS writes to int v_rows, not to the
-- boolean v_growth_done / v_family_done (would have caused a runtime error).
-- -----------------------------------------------------------------------------
create or replace function compute_event_shortlists(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_answered  int;
  v_threshold     int;
  v_size          int;
  v_use_growth    boolean;
  v_use_family    boolean;
  v_total_written int := 0;
  v_participant   record;
  v_partner       record;
  v_rank          int;
  v_growth_done   boolean;
  v_family_done   boolean;
  v_rows          int;
begin
  select reveal_threshold, shortlist_size, min_answered, include_growth_pick, include_family_pick
    into v_threshold, v_size, v_min_answered, v_use_growth, v_use_family
    from events_singles_config where event_id = p_event_id;
  if not found then
    v_threshold := 85; v_size := 5; v_min_answered := 7;
    v_use_growth := true; v_use_family := true;
  end if;

  delete from events_singles_pair_scores where event_id = p_event_id;

  insert into events_singles_pair_scores
    (event_id, participant_a, participant_b, pairwise_score, meeting_fit, final_score, connection_shape)
  select
    p_event_id,
    least(a.id, b.id),
    greatest(a.id, b.id),
    pairwise_score(a.id, b.id, v_min_answered),
    meeting_fit(a.id, b.id),
    final_score(a.id, b.id, v_min_answered),
    (select connection_shape from events_singles_family_matrix
       where viewer_family = a.archetype_realm and subject_family = b.archetype_realm)
  from event_participants a
  join event_participants b on b.event_id = a.event_id and b.id <> a.id
  where a.event_id = p_event_id
    and a.id < b.id
    and a.archetype_realm is not null and b.archetype_realm is not null
    and pairwise_score(a.id, b.id, v_min_answered) is not null;

  delete from events_singles_shortlist where event_id = p_event_id;

  for v_participant in
    -- Alias archetype_realm as family so inner blocks use v_participant.family
    select id, archetype_realm as family
    from event_participants
    where event_id = p_event_id and archetype_realm is not null
  loop
    v_rank := 0;
    v_growth_done := not v_use_growth;
    v_family_done := not v_use_family;

    -- Top overall picks (3 of 5)
    for v_partner in
      with my_pairs as (
        select
          case when participant_a = v_participant.id then participant_b else participant_a end as partner_id,
          final_score,
          connection_shape
        from events_singles_pair_scores
        where event_id = p_event_id
          and (participant_a = v_participant.id or participant_b = v_participant.id)
      )
      select mp.partner_id, mp.final_score, mp.connection_shape
      from my_pairs mp
      order by mp.final_score desc
      limit 3
    loop
      v_rank := v_rank + 1;
      insert into events_singles_shortlist
        (event_id, participant_id, partner_id, pick_type, rank,
         final_score, score_revealed, connection_shape, framing_line, conversation_prompt)
      values
        (p_event_id, v_participant.id, v_partner.partner_id, 'top_overall', v_rank,
         v_partner.final_score,
         v_partner.final_score >= v_threshold,
         v_partner.connection_shape,
         pick_framing_line(v_participant.id, v_partner.partner_id),
         shared_top_answer_prompt(v_participant.id, v_partner.partner_id));
      v_total_written := v_total_written + 1;
    end loop;

    -- Growth pick (1 of 5) — highest matrix.growth not already in shortlist
    if not v_growth_done then
      with my_pairs as (
        select
          case when participant_a = v_participant.id then participant_b else participant_a end as partner_id,
          final_score,
          connection_shape
        from events_singles_pair_scores
        where event_id = p_event_id
          and (participant_a = v_participant.id or participant_b = v_participant.id)
      ),
      candidate as (
        select mp.partner_id, mp.final_score, mp.connection_shape, m.growth
        from my_pairs mp
        join event_participants p on p.id = mp.partner_id
        join events_singles_family_matrix m
          on m.viewer_family = v_participant.family
         and m.subject_family = p.archetype_realm
        where mp.final_score >= 50
          and not exists (
            select 1 from events_singles_shortlist s
            where s.event_id = p_event_id
              and s.participant_id = v_participant.id
              and s.partner_id = mp.partner_id
          )
        order by m.growth desc, mp.final_score desc
        limit 1
      )
      insert into events_singles_shortlist
        (event_id, participant_id, partner_id, pick_type, rank,
         final_score, score_revealed, connection_shape, framing_line, conversation_prompt)
      select
        p_event_id, v_participant.id, c.partner_id, 'growth_pick', 4,
        c.final_score,
        c.final_score >= v_threshold,
        c.connection_shape,
        coalesce(
          (select framing_line from events_singles_framing_bank where profile_key = 'growth_pick_default'),
          'Different rhythm to yours. The interesting one.'
        ),
        shared_top_answer_prompt(v_participant.id, c.partner_id)
      from candidate c;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        v_growth_done := true;
        v_total_written := v_total_written + 1;
      end if;
    end if;

    -- Family pick (1 of 5) — same realm, not already in shortlist
    if not v_family_done then
      with my_pairs as (
        select
          case when participant_a = v_participant.id then participant_b else participant_a end as partner_id,
          final_score,
          connection_shape
        from events_singles_pair_scores
        where event_id = p_event_id
          and (participant_a = v_participant.id or participant_b = v_participant.id)
      ),
      candidate as (
        select mp.partner_id, mp.final_score, mp.connection_shape
        from my_pairs mp
        join event_participants p on p.id = mp.partner_id
        where p.archetype_realm = v_participant.family
          and not exists (
            select 1 from events_singles_shortlist s
            where s.event_id = p_event_id
              and s.participant_id = v_participant.id
              and s.partner_id = mp.partner_id
          )
        order by mp.final_score desc
        limit 1
      )
      insert into events_singles_shortlist
        (event_id, participant_id, partner_id, pick_type, rank,
         final_score, score_revealed, connection_shape, framing_line, conversation_prompt)
      select
        p_event_id, v_participant.id, c.partner_id, 'family_pick', 5,
        c.final_score,
        c.final_score >= v_threshold,
        c.connection_shape,
        coalesce(
          (select framing_line from events_singles_framing_bank where profile_key = 'family_pick_default'),
          'Same family as you. The familiar one.'
        ),
        shared_top_answer_prompt(v_participant.id, c.partner_id)
      from candidate c;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        v_family_done := true;
        v_total_written := v_total_written + 1;
      end if;
    end if;

  end loop;

  update events_singles_config set computed_at = now() where event_id = p_event_id;
  return v_total_written;
end;
$$;

comment on function compute_event_shortlists is
  'Orchestrator. Recomputes all pair scores and per-participant shortlists for an event.';

-- -----------------------------------------------------------------------------
-- Host aggregate views (SECURITY DEFINER — no raw scores exposed)
-- -----------------------------------------------------------------------------
create or replace function event_cohesion_score(p_event_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(avg(final_score), 1)
  from events_singles_pair_scores
  where event_id = p_event_id;
$$;

create or replace function event_family_distribution(p_event_id uuid)
returns table (family text, n int)
language sql
stable
security definer
set search_path = public
as $$
  select archetype_realm as family, count(*)::int
  from event_participants
  where event_id = p_event_id and archetype_realm is not null
  group by archetype_realm
  order by archetype_realm;
$$;

-- =============================================================================
-- End migration 04
-- =============================================================================
