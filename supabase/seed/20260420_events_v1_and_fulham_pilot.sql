-- VirWave Events — v1 question catalog + Fulham HIIT Social pilot event.
--
-- Safe to re-run: questions use (version, slug) uniqueness + on conflict,
-- and the event uses (code) uniqueness + on conflict.
--
-- BEFORE RUNNING:
--   1. Sign in once at events.virwave.com/host with your host email
--      so an auth.users row exists for you.
--   2. Replace 'REPLACE_WITH_HOST_EMAIL' below with that email.
--   3. Set the starts_at / capacity to your actual pilot values.


-- =============================================================
-- Question catalog — version 1
-- =============================================================
-- 10 single-choice questions, 4 options each. Each option has a short
-- identifier (used by the matcher) and human-readable label.
-- Voice: warm, plain, neurodivergent-affirming. No guilt mechanics.

insert into event_questions (version, slug, prompt, options) values
  (1, 'recharge',
   'After a big day, what recharges you most?',
   '[
     {"id":"solo","label":"Quiet time alone"},
     {"id":"one_on_one","label":"One close friend, one conversation"},
     {"id":"small_group","label":"A handful of people, low-key"},
     {"id":"crowd","label":"Somewhere alive with energy"}
   ]'::jsonb),

  (1, 'conflict',
   'When you disagree with someone close, you usually…',
   '[
     {"id":"direct","label":"Say it straight, soon"},
     {"id":"curious","label":"Ask questions first"},
     {"id":"process","label":"Need time before you respond"},
     {"id":"harmony","label":"Let it go for the peace"}
   ]'::jsonb),

  (1, 'stress',
   'Under pressure, you tend to…',
   '[
     {"id":"push","label":"Speed up and push through"},
     {"id":"plan","label":"Slow down and plan"},
     {"id":"reach","label":"Reach out for support"},
     {"id":"reset","label":"Step away to reset"}
   ]'::jsonb),

  (1, 'anchor',
   'Which matters most to you right now?',
   '[
     {"id":"growth","label":"Growth"},
     {"id":"connection","label":"Connection"},
     {"id":"freedom","label":"Freedom"},
     {"id":"stability","label":"Stability"}
   ]'::jsonb),

  (1, 'listening',
   'In conversation, you mostly…',
   '[
     {"id":"curious","label":"Ask curious questions"},
     {"id":"share","label":"Share your own perspective"},
     {"id":"hold","label":"Listen deeply without jumping in"},
     {"id":"mirror","label":"Reflect back what you hear"}
   ]'::jsonb),

  (1, 'pace',
   'Your ideal Saturday morning is…',
   '[
     {"id":"early","label":"Up early, already moving"},
     {"id":"slow","label":"Slow coffee, then action"},
     {"id":"wander","label":"A long, unplanned wander"},
     {"id":"rest","label":"Full rest"}
   ]'::jsonb),

  (1, 'feedback',
   'When a friend asks for honest feedback, you…',
   '[
     {"id":"straight","label":"Tell it straight"},
     {"id":"gentle","label":"Soften it with care"},
     {"id":"ask","label":"Ask what they need first"},
     {"id":"reflect","label":"Turn it back as questions"}
   ]'::jsonb),

  (1, 'edge',
   'The thing you''re working on most right now is…',
   '[
     {"id":"present","label":"Being more present"},
     {"id":"voice","label":"Speaking up more"},
     {"id":"boundaries","label":"Setting boundaries"},
     {"id":"gentle","label":"Being gentler with yourself"}
   ]'::jsonb),

  (1, 'trust',
   'You trust someone fastest when they…',
   '[
     {"id":"consistent","label":"Show up consistently"},
     {"id":"vulnerable","label":"Share something vulnerable"},
     {"id":"follow_through","label":"Follow through on small things"},
     {"id":"laugh","label":"Can laugh at themselves"}
   ]'::jsonb),

  (1, 'depth',
   'You''d rather spend two hours…',
   '[
     {"id":"deep","label":"In one deep conversation"},
     {"id":"many","label":"In several light ones"},
     {"id":"side","label":"Doing something together in quiet"},
     {"id":"move","label":"Moving or dancing side-by-side"}
   ]'::jsonb)

on conflict (version, slug) do update
  set prompt  = excluded.prompt,
      options = excluded.options,
      active  = true;


-- =============================================================
-- Pilot event: Wednesday HIIT Social — Fulham
-- =============================================================
-- Uses a DO block so we can look up the host by email rather than
-- hardcoding a uuid. Set the email below to your host account.

do $$
declare
  v_host_email text := 'REPLACE_WITH_HOST_EMAIL';
  v_host_id    uuid;
begin
  select id into v_host_id from auth.users where email = v_host_email;
  if v_host_id is null then
    raise exception
      'host % not found — sign in once at /host with this email first',
      v_host_email;
  end if;

  insert into events (
    code, title, subtitle,
    host_id, mode, kind, status,
    starts_at, ends_at,
    venue, city, country,
    capacity,
    blurb
  ) values (
    'fulham-hiit-apr22',
    'HIIT Social — Fulham',
    'Move together. Meet better.',
    v_host_id,
    'tables',
    'mixer',
    'upcoming',
    '2026-04-22 19:00:00+01',   -- Wednesday 22 Apr, 19:00 BST
    '2026-04-22 21:00:00+01',
    'Fulham',
    'London',
    'United Kingdom',
    30,
    'A pilot run of VirWave Events at the Wednesday HIIT Social. Answer ten quick questions before class — we''ll match the room so the post-workout chat lands well.'
  )
  on conflict (code) do update
    set title     = excluded.title,
        subtitle  = excluded.subtitle,
        mode      = excluded.mode,
        kind      = excluded.kind,
        status    = excluded.status,
        starts_at = excluded.starts_at,
        ends_at   = excluded.ends_at,
        venue     = excluded.venue,
        city      = excluded.city,
        country   = excluded.country,
        capacity  = excluded.capacity,
        blurb     = excluded.blurb;

  raise notice 'pilot event seeded: code=fulham-hiit-apr22, host=%', v_host_email;
end $$;
