-- VirWave Singles Group — schema, RLS, reference seeds
-- Handoff: tasks/singles-group-april-2026/README.md
--
-- Naming note: the handoff doc uses the `events_singles_*` prefix. This
-- codebase's existing events tables are singular (`event_participants`,
-- `event_answers`, `event_matches`). To stay consistent with the
-- neighbours, the new tables use `event_singles_*`.
--
-- Answer storage reuses the existing `event_answers` table. For singles
-- questions, `event_answers.value` stores the ordinal index '0'..'3' as
-- text. The display label is resolved from `event_singles_questions.options`.


-- =============================================================
-- Tables
-- =============================================================

create table event_singles_config (
  event_id              uuid primary key references events(id) on delete cascade,
  reveal_threshold      int     not null default 85 check (reveal_threshold between 0 and 100),
  shortlist_size        int     not null default 5  check (shortlist_size   between 1 and 20),
  min_answered          int     not null default 7  check (min_answered     between 1 and 10),
  mutual_match_visible  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);


create table event_singles_questions (
  id         text primary key,
  dimension  text not null check (dimension in ('values','communication','emotional','stress','intimacy')),
  prompt     text not null,
  options    jsonb not null,
  sort_order int  not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
);

create index event_singles_questions_active_idx on event_singles_questions (active, sort_order);


create table event_singles_dimension_weights (
  dimension text primary key check (dimension in ('values','communication','emotional','stress','intimacy')),
  weight    numeric not null check (weight > 0)
);


-- Realm matrix. Matches `event_participants.archetype_realm` (text).
-- Stored directionally (both A→B and B→A rows). Scoring averages the two
-- directions to get a symmetric meeting_fit (see 02_scoring_functions.sql).
create table event_singles_realm_matrix (
  realm_a   text not null,
  realm_b   text not null,
  resonance numeric not null check (resonance between 0 and 100),
  friction  numeric not null check (friction  between 0 and 100),
  growth    numeric not null check (growth    between 0 and 100),
  primary key (realm_a, realm_b)
);


create table event_singles_framing_bank (
  id           serial primary key,
  axis_profile text not null,
  line         text not null,
  active       boolean not null default true,
  unique (axis_profile, line)
);

create index event_singles_framing_bank_axis_idx on event_singles_framing_bank (axis_profile, active);


-- Cached pair math. Symmetric — only (user_a < user_b) stored.
-- Host-read allowed (via aggregate functions). Never SELECTed by clients
-- directly — query event_cohesion_score() / event_realm_distribution().
create table event_singles_pair_scores (
  event_id         uuid not null references events(id) on delete cascade,
  user_a           uuid not null references auth.users(id) on delete cascade,
  user_b           uuid not null references auth.users(id) on delete cascade,
  pairwise_score   numeric,
  meeting_fit      numeric,
  final_score      numeric,
  answered_shared  int  not null default 0,
  computed_at      timestamptz not null default now(),
  primary key (event_id, user_a, user_b),
  check (user_a < user_b)
);

create index event_singles_pair_scores_event_idx on event_singles_pair_scores (event_id);


-- Per-participant shortlist. Self-readable only.
create table event_singles_shortlist (
  event_id       uuid not null references events(id) on delete cascade,
  participant_id uuid not null references auth.users(id) on delete cascade,
  rank           int  not null check (rank between 1 and 20),
  other_id       uuid not null references auth.users(id) on delete cascade,
  pick_type      text not null check (pick_type in ('top','growth','familiar')),
  final_score    numeric not null,
  show_score     boolean not null default false,
  framing        text,
  computed_at    timestamptz not null default now(),
  primary key (event_id, participant_id, rank),
  check (participant_id <> other_id)
);

create index event_singles_shortlist_participant_idx on event_singles_shortlist (event_id, participant_id);


-- =============================================================
-- RLS: enable
-- =============================================================

alter table event_singles_config            enable row level security;
alter table event_singles_questions         enable row level security;
alter table event_singles_dimension_weights enable row level security;
alter table event_singles_realm_matrix      enable row level security;
alter table event_singles_framing_bank      enable row level security;
alter table event_singles_pair_scores       enable row level security;
alter table event_singles_shortlist         enable row level security;


-- =============================================================
-- RLS: config — public read (participants need threshold/size), host write
-- =============================================================

create policy event_singles_config_public_read on event_singles_config
  for select using (
    exists (select 1 from events e where e.id = event_id
            and e.status in ('upcoming','live','ended'))
  );

create policy event_singles_config_host_write on event_singles_config
  for all using (
    exists (select 1 from events e where e.id = event_id and e.host_id = auth.uid())
  ) with check (
    exists (select 1 from events e where e.id = event_id and e.host_id = auth.uid())
  );


-- =============================================================
-- RLS: reference tables — public read, service_role writes
-- =============================================================

create policy event_singles_questions_public_read on event_singles_questions
  for select using (active = true);

create policy event_singles_dimension_weights_public_read on event_singles_dimension_weights
  for select using (true);

create policy event_singles_realm_matrix_public_read on event_singles_realm_matrix
  for select using (true);

create policy event_singles_framing_bank_public_read on event_singles_framing_bank
  for select using (active = true);


-- =============================================================
-- RLS: pair_scores — host-readable for own event. Never self-exposed.
-- Clients never SELECT; host dashboards call aggregate functions only.
-- =============================================================

create policy event_singles_pair_scores_host_read on event_singles_pair_scores
  for select using (
    exists (select 1 from events e where e.id = event_id and e.host_id = auth.uid())
  );
-- Writes: service_role only (via compute_event_shortlists SECURITY DEFINER).


-- =============================================================
-- RLS: shortlist — participant reads own rows only
-- =============================================================

create policy event_singles_shortlist_self_read on event_singles_shortlist
  for select using (auth.uid() = participant_id);
-- Writes: service_role only.


-- =============================================================
-- Touch updated_at on event_singles_config
-- =============================================================

create trigger event_singles_config_set_updated_at
before update on event_singles_config
for each row execute function set_updated_at();


-- =============================================================
-- Seeds: the 10 questions
-- =============================================================

insert into event_singles_questions (id, dimension, prompt, options, sort_order) values
  ('vb_01', 'values', 'When you meet someone new, your instinct is to…',
   jsonb_build_array(
     'Ask about their story and what they care about.',
     'Look for shared interests or experiences.',
     'Observe how they treat others before opening up.',
     'Keep it light and see what unfolds.'
   ), 1),
  ('cs_01', 'communication', 'When something is bothering you, you tend to…',
   jsonb_build_array(
     'Say it directly, soon after it happens.',
     'Name it once you''ve thought through what you feel.',
     'Bring it up gently when the moment feels right.',
     'Work through it yourself before deciding to share.'
   ), 2),
  ('vb_02', 'values', 'When someone you care about asks for your honest opinion…',
   jsonb_build_array(
     'Tell them the whole truth, kindly but clearly.',
     'Share what you think, framed around what helps them.',
     'Ask questions so they can find their own answer.',
     'Offer reassurance; save the hard parts for later.'
   ), 3),
  ('em_01', 'emotional', 'When someone close to you is going through something hard…',
   jsonb_build_array(
     'You''re the first to show up and stay present.',
     'You check in steadily and offer practical help.',
     'You give them space but make sure they know you''re there.',
     'You wait for them to reach out when they''re ready.'
   ), 4),
  ('cs_02', 'communication', 'When it comes to staying in touch with people you care about…',
   jsonb_build_array(
     'Frequent, small touches — messages, voice notes, memes.',
     'Regular calls or plans on a rhythm that works for both of you.',
     'Deeper catch-ups every so often, with quiet in between.',
     'Comfortable picking up any time, even after long gaps.'
   ), 5),
  ('em_02', 'emotional', 'When you are feeling something difficult, how easily can you name it?',
   jsonb_build_array(
     'Almost always — I can usually put words to it quickly.',
     'Most of the time — once I pause and notice.',
     'Sometimes — I often need to talk it out to get there.',
     'Rarely — it usually shows up in my body or behavior first.'
   ), 6),
  ('st_01', 'stress', 'When you are overwhelmed, what helps most?',
   jsonb_build_array(
     'Moving my body — walk, stretch, anything physical.',
     'Stillness — breathing, quiet, alone time.',
     'Connection — talking it through with someone I trust.',
     'Distraction — a show, a book, something else entirely.'
   ), 7),
  ('st_02', 'stress', 'When someone you love is struggling, your instinct is to…',
   jsonb_build_array(
     'Step in and help them solve it.',
     'Sit with them and listen as long as they need.',
     'Offer practical support — food, errands, logistics.',
     'Let them lead and follow their cues.'
   ), 8),
  ('in_01', 'intimacy', 'How do you let people know they matter to you?',
   jsonb_build_array(
     'Words — I tell them plainly and often.',
     'Time — I show up and make space for them.',
     'Acts — I do small things that make their life easier.',
     'Presence — I am steady, available, and consistent.'
   ), 9),
  ('in_02', 'intimacy', 'What do you need most from the people closest to you?',
   jsonb_build_array(
     'Honesty — I want to know where I stand.',
     'Steadiness — I want to know they''ll be there.',
     'Understanding — I want to feel truly seen.',
     'Space — I want trust that doesn''t require constant contact.'
   ), 10);


-- =============================================================
-- Seeds: dimension weights (README §Algorithm)
-- =============================================================

insert into event_singles_dimension_weights (dimension, weight) values
  ('values',        1.5),
  ('communication', 1.3),
  ('emotional',     1.2),
  ('stress',        1.0),
  ('intimacy',      1.0);


-- =============================================================
-- Seeds: realm matrix (16 rows for 4 realms)
--
-- Realms are placeholders aligned with VirWave's archetype language
-- (`grounded`, `expansive`, `tidal`, `luminous`). When the app's canonical
-- realm set is finalized in virwave_v3, replace these rows and any
-- participant rows that use the old names.
-- =============================================================

insert into event_singles_realm_matrix (realm_a, realm_b, resonance, friction, growth) values
  ('grounded',  'grounded',  80, 20, 40),
  ('grounded',  'expansive', 55, 35, 70),
  ('grounded',  'tidal',     65, 25, 55),
  ('grounded',  'luminous',  50, 40, 75),

  ('expansive', 'grounded',  55, 35, 70),
  ('expansive', 'expansive', 75, 25, 45),
  ('expansive', 'tidal',     60, 30, 65),
  ('expansive', 'luminous',  70, 20, 60),

  ('tidal',     'grounded',  65, 25, 55),
  ('tidal',     'expansive', 60, 30, 65),
  ('tidal',     'tidal',     78, 22, 42),
  ('tidal',     'luminous',  58, 32, 68),

  ('luminous',  'grounded',  50, 40, 75),
  ('luminous',  'expansive', 70, 20, 60),
  ('luminous',  'tidal',     58, 32, 68),
  ('luminous',  'luminous',  82, 18, 38);


-- =============================================================
-- Seeds: framing bank (10 lines by axis profile)
-- =============================================================

insert into event_singles_framing_bank (axis_profile, line) values
  ('high_values_match',        'You two seem to see the world through a similar lens.'),
  ('low_values_match',          'Different foundations — a chance to stretch or a source of friction, depending on the moment.'),
  ('high_communication_match', 'Likely to land on the same wavelength in conversation.'),
  ('low_communication_match',   'Two different rhythms — worth naming yours out loud early.'),
  ('high_emotional_match',     'Each of you knows what to do when the other feels something big.'),
  ('low_emotional_match',       'You process feelings on different timelines — patience helps here.'),
  ('high_stress_match',        'Under pressure, you reach for similar medicine.'),
  ('low_stress_match',          'When overwhelmed, you look for different things — say what you need.'),
  ('high_intimacy_match',      'You show care in ways the other naturally receives.'),
  ('low_intimacy_match',        'Your love languages don''t overlap much — make the invisible visible.');
