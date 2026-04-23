-- VirWave Plushies — a page per plushie, one row per physical tag.
--
-- Context:
--   Dad is testing tags on plushies (NFC / QR). Each plushie has a unique
--   6-char code. The code lives on the tag; scanning sends the holder to
--   /plushie/<code>. That page reads/writes this table.
--
-- Security model:
--   The code IS the capability. Holding the physical plushie (and its tag)
--   means you can rename it and describe it. There is no auth layer beyond
--   "you must know the code". This matches the physical object — whoever
--   holds the plushie decides what it is. Anon cannot touch created_at or
--   the code itself after insert (column-level grants), and the auto-touch
--   trigger keeps updated_at honest.
--
--   Worst case: someone guesses a real code and renames the plushie. The
--   holder can rename it back. No PII is stored here — it's plushie
--   personality, not account data.

create extension if not exists pgcrypto;


-- =============================================================
-- Table
-- =============================================================

create table plushies (
  code       text primary key check (code ~ '^[A-Z0-9]{6}$'),
  name       text check (name    is null or length(name)    between 1 and 60),
  species    text check (species is null or length(species) between 1 and 40),
  origin     text check (origin  is null or length(origin)  between 1 and 60),
  home       text check (home    is null or length(home)    between 1 and 60),
  story      text check (story   is null or length(story)   <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =============================================================
-- updated_at touch trigger
-- =============================================================

create or replace function plushies_touch_updated_at() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plushies_touch_updated_at_trg
  before update on plushies
  for each row execute function plushies_touch_updated_at();


-- =============================================================
-- RLS policies
-- =============================================================

alter table plushies enable row level security;

-- Anyone can read any plushie (you can see what the plushie says about itself).
create policy plushies_public_read on plushies
  for select using (true);

-- Anyone can register a new plushie by code.
-- Column grants restrict this to only the `code` field — everything else
-- starts as NULL (client derives whimsical defaults from the code hash).
create policy plushies_public_insert on plushies
  for insert with check (true);

-- Anyone with the code can update the plushie's personality.
-- Column grants restrict to name/species/origin/home/story — code, created_at,
-- and updated_at are off-limits.
create policy plushies_public_update on plushies
  for update using (true) with check (true);


-- =============================================================
-- Column-level grants (anon + authenticated)
-- =============================================================

revoke all on table plushies from anon, authenticated;
grant select                                      on table plushies to anon, authenticated;
grant insert (code)                               on table plushies to anon, authenticated;
grant update (name, species, origin, home, story) on table plushies to anon, authenticated;
