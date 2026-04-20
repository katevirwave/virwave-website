# VirWave Singles Group — Supabase Handoff

**For:** Sebastian (CTO)
**From:** Kate
**Date:** April 20, 2026
**Target project:** `virwave_v3` (existing Supabase project)

---

## What's in this folder

This folder is the handoff doc and reference. The actual files installed
into the repo are:

- `supabase/migrations/20260420000003_event_singles_schema.sql`
  — tables, RLS, reference seeds (10 questions, dimension weights, realm
  compatibility matrix, framing bank).
- `supabase/migrations/20260420000004_event_singles_scoring_functions.sql`
  — pure Postgres. Pairwise score, MeetingFit, final score (with EQ
  penalty), shortlist orchestrator, host aggregates.
- `supabase/functions/compute-shortlists/index.ts`
  — Deno-style Supabase Edge Function that wraps the orchestrator with
  auth + CORS.

No frontend code. That's a separate Sebastian call once the math lands.

---

## Reading order

If you only open one file: the scoring-functions migration. The algorithm
is four functions — `pairwise_score`, `meeting_fit`, `final_score`,
`compute_event_shortlists`. Everything else is plumbing.

---

## Install

```bash
# From the virwave-website project root
supabase db push
supabase functions deploy compute-shortlists --project-ref <virwave_v3 ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service role key>   # if not already set
```

`db push` will apply the two new timestamped migrations in order.

---

## Naming alignment

The original handoff specified `events_singles_*` tables next to
`events_*`. The existing repo uses **singular** `event_*` (e.g.
`event_participants`, `event_answers`). The new singles tables follow
that convention: `event_singles_*`.

Similarly, `archetype_family` was renamed to `archetype_realm` in
migration `20260420000002` — the matrix and host aggregate use `realm`.

---

## Data model in one picture

```
events ─┬── event_singles_config            (1:1, per-event tunables)
        │
        ├── event_participants ─────┬── event_answers                  (raw Q answers, owner-only)
        │                           │
        │                           └── event_singles_shortlist        (per-participant picks)
        │
        └── event_singles_pair_scores        (cached pair math, host-readable for aggregates)

Reference:
  event_singles_questions          (the 10 questions, stable IDs vb_01…in_02)
  event_singles_dimension_weights  (values 1.5, comms 1.3, emo 1.2, stress 1.0, intimacy 1.0)
  event_singles_realm_matrix       (16 rows: resonance / friction / growth)
  event_singles_framing_bank       (qualitative lines by axis profile)
```

Answers reuse the existing `event_answers` table. For singles questions,
`event_answers.value` is the ordinal `'0'..'3'` as text; the display
label is resolved from `event_singles_questions.options`.

---

## Algorithm in one paragraph

For each pair `(A, B)`:

- `pairwise_score(event_id, A, B)` = weighted average of per-question
  scores, where `question_score = 100 × (1 − |diff| / 3)` on the
  0..3 ordinal scale. Weighted by dimension (values 1.5, comms 1.3,
  emotional 1.2, stress 1.0, intimacy 1.0). Null if fewer than
  `min_answered` shared answers (default 7).
- `meeting_fit(event_id, A, B)` = `0.55 × resonance + 0.25 × growth −
  0.20 × friction` from the realm matrix. Symmetric (averages the two
  directional rows).
- `final_score(event_id, A, B)` = `0.65 × pairwise + 0.35 × meeting_fit`,
  then `−8` if both answered `em_02` and differ by ≥2 (EQ-mismatch
  overlay). Clamped 0..100.

Per participant, the shortlist is up to `shortlist_size` (default 5):
top 3 by `final_score` + 1 Growth stretch pick (highest matrix growth
remaining) + 1 Familiar pick (same realm, highest pairwise). `show_score`
is true when `final_score ≥ reveal_threshold` (default 85).

---

## The 10 questions (seeded into `event_singles_questions`)

| # | ID | Dimension | Question |
|---|----|-----------|----------|
| 1 | vb_01 | values        | When you meet someone new, your instinct is to… |
| 2 | cs_01 | communication | When something is bothering you, you tend to… |
| 3 | vb_02 | values        | When someone you care about asks for your honest opinion… |
| 4 | em_01 | emotional     | When someone close to you is going through something hard… |
| 5 | cs_02 | communication | When it comes to staying in touch with people you care about… |
| 6 | em_02 | emotional     | When you are feeling something difficult, how easily can you name it? |
| 7 | st_01 | stress        | When you are overwhelmed, what helps most? |
| 8 | st_02 | stress        | When someone you love is struggling, your instinct is to… |
| 9 | in_01 | intimacy      | How do you let people know they matter to you? |
| 10 | in_02 | intimacy      | What do you need most from the people closest to you? |

All four answer labels per question are seeded in the schema migration.
These match the general Reflect bank — shared content, singles-specific
scoring engine.

---

## How to test end-to-end

```sql
-- 1. Create a test event (existing events table)
insert into events (code, title, host_id, mode, kind, status, starts_at)
values ('test-singles', 'Test Singles', '<your uuid>', 'pairs', 'mixer',
        'live', now())
returning id;

-- 2. Configure singles tunables
insert into event_singles_config (event_id, reveal_threshold)
values ('<event id>', 85);

-- 3. Add participants (events.join_event is the intended path; or
--    service_role insert into event_participants for test fixtures).

-- 4. Seed event_answers rows — at least min_answered per participant.
--    value is '0' | '1' | '2' | '3' for singles questions.

-- 5. Run the orchestrator
select compute_event_shortlists('<event id>');

-- 6. Inspect
select * from event_singles_shortlist
  where event_id = '<event id>'
  order by participant_id, rank;

select event_cohesion_score('<event id>');
select * from event_realm_distribution('<event id>');
```

From the edge function, authenticated as the host:

```
POST /functions/v1/compute-shortlists
Authorization: Bearer <host JWT>
{ "event_id": "<uuid>" }
```

---

## Security notes

- `event_answers` rows are **never** readable by hosts (owner-only RLS).
  The edge function verifies host ownership, then promotes to service
  role to run `compute_event_shortlists`. Results flow into
  `event_singles_shortlist` (participant-self readable) and
  `event_singles_pair_scores` (host-readable for aggregates only).
- Participants see only their own shortlist rows. No one sees another
  participant's shortlist or the score matrix directly.
- `compute_event_shortlists`, `event_cohesion_score`, and
  `event_realm_distribution` are `SECURITY DEFINER` with locked
  `search_path = public`. The compute function is revoked from
  `authenticated` — only service role (edge function) calls it.
- Host dashboards must query `event_cohesion_score()` and
  `event_realm_distribution()`, never SELECT `event_singles_pair_scores`
  directly, even though host RLS permits it — keep a single audited
  surface.

---

## Tunables

Per-event tunables live in `event_singles_config` (editable without a
deploy). Product-philosophy constants live in functions (tuning them is
a conscious migration).

| What | Where | Default |
|------|-------|---------|
| Dimension weights | `event_singles_dimension_weights` | values 1.5, comms 1.3, emo 1.2, stress 1.0, intimacy 1.0 |
| Realm matrix values | `event_singles_realm_matrix` | 16 rows (4 realms × 4) |
| Per-event reveal threshold | `event_singles_config.reveal_threshold` | 85 |
| Shortlist size | `event_singles_config.shortlist_size` | 5 |
| Minimum answered | `event_singles_config.min_answered` | 7 |
| Framing lines | `event_singles_framing_bank` | 10 seeded |
| MeetingFit weights (0.55/0.25/0.20) | hardcoded in `meeting_fit()` | change via migration |
| final_score mix (0.65/0.35) | hardcoded in `final_score()` | change via migration |
| EQ penalty (−8 at gap ≥2) | hardcoded in `final_score()` | change via migration |

---

## Known gaps (v1 → v2)

- **Realm names are placeholders.** `grounded / expansive / tidal /
  luminous` are stand-ins. Replace with virwave_v3's canonical realm set
  before first live event (update matrix rows + any participant rows
  written with old names).
- **Answer labels are drafted, not voice-tuned.** The 10 question option
  sets are plausible spreads along each dimension. Voice review is a
  prerequisite for the first pilot.
- **No live in-room features.** Pre-event compute only. Realtime pairings
  and presence are a v2 problem.
- **No mutual-match visibility.** `event_singles_config.mutual_match_visible`
  exists but no UI surfaces it yet.
- **No bridged mode trigger.** Bridging singles answers into
  `user_portraits` isn't wired here — comes from the separate events
  build plan.
- **No score recomputation triggers.** Shortlists are stale until
  `compute_event_shortlists()` is called. Either add a `pg_cron` job for
  T-24h, or trigger from `after insert on event_answers` once the Nth
  answer arrives. Sebastian's call.

---

## What I'd like a second pair of eyes on

1. `SECURITY DEFINER` + `search_path = public` on the orchestrator —
   does this match the security baseline elsewhere in virwave_v3?
2. Pair-score storage: we cache every `(A, B)` pair, not just those
   above a cutoff. 60 × 60 = 1770 rows/event. Fine at today's scale;
   flagging in case pool sizes change.
3. The `0.65/0.35` final_score mix and the `−8` EQ penalty are
   calibrated by intuition, not data. First pilot event should log raw
   scores so we can regress these constants.

---

## Files touched

- `supabase/migrations/20260420000003_event_singles_schema.sql`
- `supabase/migrations/20260420000004_event_singles_scoring_functions.sql`
- `supabase/functions/compute-shortlists/index.ts`
- `tasks/singles-group-april-2026/README.md` (this file)
