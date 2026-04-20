-- =============================================================================
-- VirWave — Singles Group Scoring
-- Migration 03: Schema + seed data + RLS
-- =============================================================================
-- Retargeted to this repo's existing schema:
--   events (not events_live), event_participants (composite PK + added id uuid),
--   event_answers (question_slug / text value), host_id (not host_user_id)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Add surrogate id to event_participants
-- The scoring tables reference individual participants by UUID. The existing
-- composite PK (event_id, user_id) is kept; id is a unique non-PK column.
-- -----------------------------------------------------------------------------

alter table event_participants
  add column if not exists id uuid not null default gen_random_uuid();

create unique index if not exists event_participants_id_unique
  on event_participants(id);

-- -----------------------------------------------------------------------------
-- 1. Reference: questions
-- -----------------------------------------------------------------------------

create table if not exists events_singles_questions (
  id              text primary key,
  dimension       text not null check (dimension in ('values','communication','emotional','stress','intimacy')),
  day_number      int  not null check (day_number between 1 and 10),
  text            text not null,
  option_1_label  text not null,
  option_2_label  text not null,
  option_3_label  text not null,
  option_4_label  text not null,
  created_at      timestamptz not null default now()
);

comment on table events_singles_questions is
  'Canonical 10-question Reflect bank for singles-group events. Stable IDs.';

-- -----------------------------------------------------------------------------
-- 2. Reference: dimension weights
-- -----------------------------------------------------------------------------

create table if not exists events_singles_dimension_weights (
  dimension  text primary key check (dimension in ('values','communication','emotional','stress','intimacy')),
  weight     numeric(4,2) not null
);

insert into events_singles_dimension_weights (dimension, weight) values
  ('values',         1.5),
  ('communication',  1.3),
  ('emotional',      1.2),
  ('stress',         1.0),
  ('intimacy',       1.0)
on conflict (dimension) do update set weight = excluded.weight;

-- -----------------------------------------------------------------------------
-- 3. Reference: realm compatibility matrix
-- Realm = archetype_realm in event_participants (renamed from archetype_family).
-- -----------------------------------------------------------------------------

create table if not exists events_singles_family_matrix (
  viewer_family    text not null check (viewer_family  in ('grounded','flowing','signaling','radiating')),
  subject_family   text not null check (subject_family in ('grounded','flowing','signaling','radiating')),
  connection_shape text not null,
  resonance        int  not null check (resonance between 0 and 100),
  friction         int  not null check (friction  between 0 and 100),
  growth           int  not null check (growth    between 0 and 100),
  primary key (viewer_family, subject_family)
);

insert into events_singles_family_matrix (viewer_family, subject_family, connection_shape, resonance, friction, growth) values
  ('grounded',  'grounded',  'Rectangle',       88, 30, 35),
  ('grounded',  'flowing',   'Rounded square',  62, 58, 78),
  ('grounded',  'signaling', 'Diamond',         55, 68, 80),
  ('grounded',  'radiating', 'Pentagon-star',   45, 72, 88),
  ('flowing',   'grounded',  'Rounded square',  64, 55, 75),
  ('flowing',   'flowing',   'Infinity loop',   90, 35, 40),
  ('flowing',   'signaling', 'Teardrop',        58, 65, 82),
  ('flowing',   'radiating', 'Petal',           78, 42, 68),
  ('signaling', 'grounded',  'Diamond',         52, 70, 82),
  ('signaling', 'flowing',   'Teardrop',        55, 68, 85),
  ('signaling', 'signaling', 'Double arrow',    92, 40, 38),
  ('signaling', 'radiating', 'Comet',           72, 48, 65),
  ('radiating', 'grounded',  'Pentagon-star',   48, 70, 85),
  ('radiating', 'flowing',   'Petal',           80, 40, 65),
  ('radiating', 'signaling', 'Comet',           74, 46, 62),
  ('radiating', 'radiating', 'Spiral',          86, 45, 42)
on conflict (viewer_family, subject_family) do update set
  connection_shape = excluded.connection_shape,
  resonance        = excluded.resonance,
  friction         = excluded.friction,
  growth           = excluded.growth;

-- -----------------------------------------------------------------------------
-- 4. Event config
-- References events(id) — the existing events table in this repo.
-- -----------------------------------------------------------------------------

create table if not exists events_singles_config (
  event_id            uuid primary key references events(id) on delete cascade,
  reveal_threshold    int  not null default 85 check (reveal_threshold between 80 and 95),
  shortlist_size      int  not null default 5  check (shortlist_size between 3 and 8),
  min_answered        int  not null default 7  check (min_answered between 5 and 10),
  include_growth_pick boolean not null default true,
  include_family_pick boolean not null default true,
  mutual_match_visible boolean not null default false,
  computed_at         timestamptz,
  created_at          timestamptz not null default now()
);

comment on table events_singles_config is
  'Per-event singles-mode configuration. reveal_threshold gates numeric score display.';

-- -----------------------------------------------------------------------------
-- 5. Computed pair scores
-- References event_participants(id) — the surrogate UUID added above.
-- -----------------------------------------------------------------------------

create table if not exists events_singles_pair_scores (
  event_id        uuid not null references events(id) on delete cascade,
  participant_a   uuid not null references event_participants(id) on delete cascade,
  participant_b   uuid not null references event_participants(id) on delete cascade,
  pairwise_score  numeric(5,2) not null,
  meeting_fit     numeric(5,2) not null,
  final_score     numeric(5,2) not null,
  connection_shape text,
  computed_at     timestamptz not null default now(),
  primary key (event_id, participant_a, participant_b),
  check (participant_a < participant_b)
);

create index if not exists idx_singles_pair_scores_event
  on events_singles_pair_scores(event_id);

-- -----------------------------------------------------------------------------
-- 6. Shortlists
-- -----------------------------------------------------------------------------

create type events_singles_pick_type
  as enum ('top_overall', 'growth_pick', 'family_pick');

create table if not exists events_singles_shortlist (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references events(id) on delete cascade,
  participant_id      uuid not null references event_participants(id) on delete cascade,
  partner_id          uuid not null references event_participants(id) on delete cascade,
  pick_type           events_singles_pick_type not null,
  rank                int  not null,
  final_score         numeric(5,2) not null,
  score_revealed      boolean not null,
  connection_shape    text,
  framing_line        text not null,
  conversation_prompt text,
  computed_at         timestamptz not null default now(),
  unique (event_id, participant_id, partner_id)
);

create index if not exists idx_singles_shortlist_participant
  on events_singles_shortlist(event_id, participant_id);

-- -----------------------------------------------------------------------------
-- 7. Framing content bank
-- -----------------------------------------------------------------------------

create table if not exists events_singles_framing_bank (
  id           serial primary key,
  profile_key  text not null unique,
  framing_line text not null
);

insert into events_singles_framing_bank (profile_key, framing_line) values
  ('high_res_low_growth',  'This one finds you quickly. The work is remembering to stretch.'),
  ('high_res_high_growth', 'Rare — easy meeting and real change live in the same connection.'),
  ('mid_res_high_growth',  'This takes translation. What comes back is a version of you that only this connection grows.'),
  ('low_res_high_growth',  'You will not find each other fast. Stay long enough and you will find something you could not alone.'),
  ('high_friction_high_growth', 'The rub here is the point. Do not mistake friction for incompatibility.'),
  ('high_friction_low_growth',  'Honest about the cost. The playbook gives you the tools; the decision is yours.'),
  ('balanced',              'Honest meeting, honest friction, room to move.'),
  ('growth_pick_default',   'Different rhythm to yours. The interesting one.'),
  ('family_pick_default',   'Same family as you. The familiar one.'),
  ('no_match_floor',        'This room is unusual for you. Your shortlist is shorter — and the people on it are worth seeking out.')
on conflict (profile_key) do update set framing_line = excluded.framing_line;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table events_singles_questions         enable row level security;
alter table events_singles_dimension_weights enable row level security;
alter table events_singles_family_matrix     enable row level security;
alter table events_singles_config            enable row level security;
alter table events_singles_pair_scores       enable row level security;
alter table events_singles_shortlist         enable row level security;
alter table events_singles_framing_bank      enable row level security;

-- Reference tables — any authenticated user can read
create policy "reference_questions_read"
  on events_singles_questions for select
  to authenticated using (true);

create policy "reference_weights_read"
  on events_singles_dimension_weights for select
  to authenticated using (true);

create policy "reference_matrix_read"
  on events_singles_family_matrix for select
  to authenticated using (true);

create policy "reference_framing_read"
  on events_singles_framing_bank for select
  to authenticated using (true);

-- Event config — host of that event only
-- Uses host_id (matches events.host_id in this repo, not host_user_id)
create policy "config_host_read"
  on events_singles_config for select
  to authenticated using (
    exists (
      select 1 from events e
      where e.id = events_singles_config.event_id
        and e.host_id = auth.uid()
    )
  );

create policy "config_host_write"
  on events_singles_config for all
  to authenticated using (
    exists (
      select 1 from events e
      where e.id = events_singles_config.event_id
        and e.host_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from events e
      where e.id = events_singles_config.event_id
        and e.host_id = auth.uid()
    )
  );

-- Pair scores — host-only aggregate read; service role bypasses for compute
create policy "pair_scores_host_aggregate_only"
  on events_singles_pair_scores for select
  to authenticated using (
    exists (
      select 1 from events e
      where e.id = events_singles_pair_scores.event_id
        and e.host_id = auth.uid()
    )
  );

-- Shortlists — each participant sees only their own rows
create policy "shortlist_own_read"
  on events_singles_shortlist for select
  to authenticated using (
    exists (
      select 1 from event_participants p
      where p.id = events_singles_shortlist.participant_id
        and p.user_id = auth.uid()
    )
  );

-- =============================================================================
-- Seed: the 10 questions
-- IDs match event_answers.question_slug values (e.g. 'vb_01', 'em_02')
-- =============================================================================

insert into events_singles_questions (id, dimension, day_number, text, option_1_label, option_2_label, option_3_label, option_4_label) values
  ('vb_01', 'values',        1,  'When you meet someone new, your instinct is to…',
    'Hold back until they prove themselves',
    'Stay open but watch carefully',
    'Give them the benefit of the doubt',
    'Trust them fully until they show you otherwise'),

  ('cs_01', 'communication', 2,  'When something is bothering you, you tend to…',
    'Keep it to yourself and work through it alone',
    'Wait until you have processed before saying anything',
    'Bring it up fairly soon, once you have found the right words',
    'Say it right away — you cannot sit with it'),

  ('vb_02', 'values',        3,  'When someone you care about asks for your honest opinion…',
    'You soften it — their feelings come first',
    'You are honest but gentle — you choose your words carefully',
    'You tell them the truth, clearly but with care',
    'You say exactly what you think — they asked, so you answer'),

  ('em_01', 'emotional',     4,  'When someone close to you is going through something hard…',
    'You stay steady — you are the calm in their storm',
    'You feel for them but keep your own centre',
    'Their pain touches you — you carry some of it with you',
    'You feel it in your body — their emotions become yours'),

  ('cs_02', 'communication', 5,  'When it comes to staying in touch with people you care about…',
    'You wait for them to reach out — you assume they know you care',
    'You check in occasionally, when you think of them',
    'You reach out regularly — it matters to you to stay connected',
    'You are always the one reaching out — you need the connection to feel alive'),

  ('em_02', 'emotional',     6,  'When you are feeling something difficult, how easily can you name it?',
    'I usually do not know what I am feeling until much later',
    'I know something is off but struggle to name it precisely',
    'I can usually identify what I am feeling with some reflection',
    'I name my emotions clearly and quickly — I always know what is happening inside me'),

  ('st_01', 'stress',        7,  'When you are overwhelmed, what helps most?',
    'Being alone — I need space to think',
    'Doing something with my hands — a task, a walk, anything concrete',
    'Talking it through with one person I trust',
    'Being around people — I cannot process alone'),

  ('st_02', 'stress',        8,  'When someone you love is struggling, your instinct is to…',
    'Give them space — I do not want to crowd them',
    'Be nearby but quiet — present without pushing',
    'Ask what they need and follow their lead',
    'Move toward them immediately — check in, show up, be there'),

  ('in_01', 'intimacy',      9,  'How do you let people know they matter to you?',
    'Through what I do — actions, not words',
    'Through being reliable — I show up consistently',
    'Through attention — I remember the small things',
    'Through words — I tell them directly and often'),

  ('in_02', 'intimacy',      10, 'What do you need most from the people closest to you?',
    'Space — room to be myself without explaining',
    'Patience — let me come to you in my own time',
    'Presence — just be there, even when it is hard',
    'Words — tell me where I stand, tell me I am safe')
on conflict (id) do update set
  dimension      = excluded.dimension,
  day_number     = excluded.day_number,
  text           = excluded.text,
  option_1_label = excluded.option_1_label,
  option_2_label = excluded.option_2_label,
  option_3_label = excluded.option_3_label,
  option_4_label = excluded.option_4_label;

-- =============================================================================
-- End migration 03
-- =============================================================================
