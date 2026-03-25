# Plushie Identity Pages — Comprehensive Plan

**Status:** Locked  
**Date:** 2026-03-15  
**Last updated:** 2026-03-15 (security audit + progressive trust model)  
**Owner:** Sebastian (dev), Kate (product), David (hardware)  
**Repo:** virwave-website (primary), Supabase (schema)  
**No changes to:** virwave_v3 (V1), virwave_api (read-only)

---

## 1. What We're Building

A **plushie passport** system on virwave.com. Each physical VirWave plushie has a QR code that links to a unique web page showing:

- The plushie's **identity** — name, origin type (ocean, forest, mountains, desert, savanna)
- Its **current location** — city + country, updated by the person who claimed it
- A **travel history** — append-only log of everywhere it's been
- A **bridge to VirWave** — soft CTA introducing the scanner to the app ecosystem

This creates a living digital companion for a physical product. Think geocaching travel bugs meets Apple's editorial product pages.

---

## 2. Architecture Decisions (Locked)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| P-1 | **URL format** | `/P/?id=<UID>` | Static `index.html` + query param. Works on GitHub Pages with zero routing config. QR encodes `https://www.virwave.com/P/?id=K7MX2PAB`. |
| P-2 | **UID format** | **8-char** uppercase alphanumeric | 2.8 trillion combinations. Enumeration-proof at any practical request rate. Non-sequential. Example: `K7MX2PAB`. |
| P-3 | **Data model** | Two tables: `plushies` (admin-seeded, read-only) + `plushie_checkins` (append-only, PIN-gated insert) | Append-only check-ins are safer than allowing row updates. Automatically creates travel history. No destructive operations exposed to anon users. |
| P-4 | **Ownership model** | **PIN-based claim** — first scanner sets 4-digit PIN, future updates require PIN. Reading is always open. | Prevents vandalism, matches physical trust model (give PIN when you give the plushie). No account required. See §2.1. |
| P-5 | **Origin types** | Fixed curated enum: `ocean`, `forest`, `mountains`, `desert`, `savanna` | Collectibility, quality control on backstories, future app integration (origin → themed breathing sounds/visuals). Extensible via DB enum, not freeform. Matches David's 5 hardware biomes. |
| P-6 | **Security model** | 8-char UIDs + PIN-gated writes + DB rate limiting + RLS + input validation. No email in check-ins. | See §4 (full security model). |
| P-7 | **Progressive trust** | V1: PIN claim → V1.5: optional account linking → V2: in-app claim as primary | See §2.1. Schema supports all three layers from day one. |
| P-8 | **Design language** | Match virwave.com palette + 8pt grid. Dark immersive hero (navy gradient) for origin story, light surface for form/history. | Consistent with existing site. Future app integration uses the v3 design system (glass scale, springs). |

### 2.1 Progressive Trust Model (Locked)

The plushie page follows a **three-layer trust progression**. V1 ships the first layer. Schema supports all three from day one — no future migrations needed to enable layers 2 and 3.

#### Layer 1 — PIN Claim (V1, shipping now)

- **First scan → claim**: First person to scan enters a display name for themselves + sets a **4-digit PIN**. This "activates" the plushie.
- **PIN protects writes**: To add a new location, enter the 4-digit PIN. Proves you hold the plushie (or were given the PIN).
- **Transfer**: When the plushie changes hands physically, give the new person the PIN. New holder can update PIN to their own.
- **Reading is open**: Anyone with the link sees the plushie's story, origin, location, and travel history. Every scan = brand impression.
- **Soft CTA**: Bottom of page links to `/products/` and `/interest/` — "This plushie's breathing patterns live in the VirWave app."
- **No email captured in check-ins**. Interest is captured via the existing `/interest/` form (already handles consent properly).

**Why PIN, not accounts:**
- Plushies are gifts. A child scans a QR excitedly — signup forms kill that moment (60-80% abandonment on forced registration).
- Kids can't create accounts (COPPA/GDPR-Article-8 parental consent requirements).
- The app isn't GA yet — forced account creation promises an ecosystem that doesn't have a "My Plushies" screen yet.
- Account-linked plushies break on physical transfer (the previous owner has to "unregister").
- "Already claimed" is a dead end — zero engagement for scanners who aren't the owner.
- virwave.com has no auth system; building Supabase Auth into a static site is non-trivial for V1.

#### Layer 2 — Optional Account Linking (V1.5, when app launches)

After someone has been tracking their plushie for weeks/months via PIN, they see:
> "Connect [Luna] to VirWave — unlock ocean breathing in the app."

This is a **warm, earned conversion** — the user already loves their plushie and trusts the brand. Conversion rates for warm prompts are 3-5x higher than forced registration.

Account linking **upgrades** the PIN, not replaces it:
- PIN still works (for kids, for when you're not logged in, for institutional settings)
- Account adds: rename, view in-app "My Plushies", transfer ownership
- `plushies.virwave_user_id` gets populated (nullable FK, already in schema)

#### Layer 3 — In-App Claim as Primary (V2)

New plushie → scan QR in the VirWave app → claimed instantly via logged-in session. The web page becomes the fallback for people who don't have the app yet.

**Rationale for progressive model:** You can always add friction later. You can't un-add it. Starting open and layering auth on top is trivially easy. Starting with mandatory accounts and trying to remove it later means data migration, flow redesign, and confused users. The conversion happens because the product is good, not because we forced a form.

---

## 3. Database Schema

### 3.1 `plushies` table

Admin-seeded. **Anon can only SELECT public columns.** No public writes except via claim RPC.

```sql
CREATE TABLE public.plushies (
  id                TEXT PRIMARY KEY,                    -- 8-char UID, e.g. 'K7MX2PAB'
  name              TEXT NOT NULL,                        -- Display name, e.g. 'Luna'
  origin_type       TEXT NOT NULL CHECK (origin_type IN (
                      'ocean', 'forest', 'mountains', 'desert', 'savanna'
                    )),
  claim_pin_hash    TEXT DEFAULT NULL,                    -- bcrypt hash of 4-digit PIN (NULL = unclaimed)
  claimed_by_name   TEXT DEFAULT NULL,                    -- Display name of claimer
  claimed_at        TIMESTAMPTZ DEFAULT NULL,             -- When first claimed
  virwave_user_id   UUID REFERENCES auth.users(id)       -- Future: link to app account (nullable)
                      DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT plushie_id_format CHECK (id ~ '^[A-Z0-9]{8}$')
);

-- RLS
ALTER TABLE public.plushies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plushies_anon_select" ON public.plushies
  FOR SELECT TO anon USING (true);

-- Column-level grants: anon CANNOT see claim_pin_hash or virwave_user_id
REVOKE ALL ON public.plushies FROM anon;
GRANT SELECT (id, name, origin_type, claimed_at, claimed_by_name, created_at) ON public.plushies TO anon;
```

### 3.2 `plushie_checkins` table

Public-read, append-only. **Inserts go through the RPC function** (PIN-verified), not direct INSERT.

```sql
CREATE TABLE public.plushie_checkins (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plushie_id      TEXT NOT NULL REFERENCES public.plushies(id),
  city            TEXT NOT NULL CHECK (char_length(city) BETWEEN 1 AND 100),
  country_code    TEXT NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),  -- ISO 3166-1 alpha-2
  country_name    TEXT NOT NULL CHECK (char_length(country_name) BETWEEN 1 AND 100),
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plushie_checkins_plushie
  ON public.plushie_checkins (plushie_id, checked_in_at DESC);

ALTER TABLE public.plushie_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_anon_select" ON public.plushie_checkins
  FOR SELECT TO anon USING (true);

-- No direct INSERT grant for anon — inserts go through RPC
GRANT SELECT ON public.plushie_checkins TO anon;
```

### 3.3 RPC Functions (PIN Verification)

All write operations go through `SECURITY DEFINER` functions that verify the PIN. The anon role never directly INSERTs into either table.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- CLAIM: First-time activation of a plushie
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_plushie(
  p_plushie_id TEXT,
  p_pin TEXT,
  p_claimed_by_name TEXT
) RETURNS JSON AS $$
DECLARE
  v_plushie RECORD;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' THEN
    RETURN json_build_object('ok', false, 'error', 'PIN must be exactly 4 digits');
  END IF;
  IF p_claimed_by_name IS NULL OR char_length(trim(p_claimed_by_name)) < 1
     OR char_length(trim(p_claimed_by_name)) > 50 THEN
    RETURN json_build_object('ok', false, 'error', 'Name must be 1-50 characters');
  END IF;

  SELECT * INTO v_plushie FROM public.plushies WHERE id = p_plushie_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_plushie.claim_pin_hash IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  UPDATE public.plushies
  SET claim_pin_hash = crypt(p_pin, gen_salt('bf')),
      claimed_by_name = trim(p_claimed_by_name),
      claimed_at = now()
  WHERE id = p_plushie_id;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CHECK IN: Add a location (requires PIN)
-- ============================================
CREATE OR REPLACE FUNCTION public.plushie_checkin(
  p_plushie_id TEXT,
  p_pin TEXT,
  p_city TEXT,
  p_country_code TEXT,
  p_country_name TEXT
) RETURNS JSON AS $$
DECLARE
  v_plushie RECORD;
BEGIN
  IF p_city IS NULL OR char_length(trim(p_city)) < 1 OR char_length(trim(p_city)) > 100 THEN
    RETURN json_build_object('ok', false, 'error', 'City must be 1-100 characters');
  END IF;
  IF p_country_code IS NULL OR p_country_code !~ '^[A-Z]{2}$' THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid country code');
  END IF;
  IF p_country_name IS NULL OR char_length(trim(p_country_name)) < 1 THEN
    RETURN json_build_object('ok', false, 'error', 'Country name required');
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' THEN
    RETURN json_build_object('ok', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  SELECT * INTO v_plushie FROM public.plushies WHERE id = p_plushie_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_plushie.claim_pin_hash IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_claimed');
  END IF;
  IF v_plushie.claim_pin_hash != crypt(p_pin, v_plushie.claim_pin_hash) THEN
    RETURN json_build_object('ok', false, 'error', 'wrong_pin');
  END IF;

  -- Rate limit: 1 per plushie per 10 minutes
  IF EXISTS (
    SELECT 1 FROM public.plushie_checkins
    WHERE plushie_id = p_plushie_id
      AND checked_in_at > now() - INTERVAL '10 minutes'
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'rate_limit',
      'message', 'This plushie was just updated. Please wait a few minutes.');
  END IF;

  -- Rate limit: 30 global per minute
  IF (SELECT count(*) FROM public.plushie_checkins
      WHERE checked_in_at > now() - INTERVAL '1 minute') >= 30 THEN
    RETURN json_build_object('ok', false, 'error', 'rate_limit',
      'message', 'Too many updates right now. Please try again shortly.');
  END IF;

  INSERT INTO public.plushie_checkins (plushie_id, city, country_code, country_name)
  VALUES (p_plushie_id, trim(p_city), p_country_code, trim(p_country_name));

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CHANGE PIN: Update PIN (requires old PIN)
-- ============================================
CREATE OR REPLACE FUNCTION public.change_plushie_pin(
  p_plushie_id TEXT,
  p_old_pin TEXT,
  p_new_pin TEXT
) RETURNS JSON AS $$
DECLARE
  v_plushie RECORD;
BEGIN
  IF p_new_pin IS NULL OR p_new_pin !~ '^\d{4}$' THEN
    RETURN json_build_object('ok', false, 'error', 'New PIN must be exactly 4 digits');
  END IF;

  SELECT * INTO v_plushie FROM public.plushies WHERE id = p_plushie_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_plushie.claim_pin_hash IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_claimed');
  END IF;
  IF v_plushie.claim_pin_hash != crypt(p_old_pin, v_plushie.claim_pin_hash) THEN
    RETURN json_build_object('ok', false, 'error', 'wrong_pin');
  END IF;

  UPDATE public.plushies
  SET claim_pin_hash = crypt(p_new_pin, gen_salt('bf'))
  WHERE id = p_plushie_id;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant anon execution on RPC functions
GRANT EXECUTE ON FUNCTION public.claim_plushie(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.plushie_checkin(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.change_plushie_pin(TEXT, TEXT, TEXT) TO anon;
```

### 3.4 Security Model (Complete)

| Threat | Mitigation |
|--------|-----------|
| **ID enumeration** | 8-char alphanumeric UIDs (2.8 trillion combinations). At 1K req/sec, full scan takes ~89 years. Non-sequential. No "list all" endpoint. |
| **Vandalism / fake locations** | 4-digit PIN required for all writes via `SECURITY DEFINER` RPC. Anon has NO direct INSERT on either table. |
| **PIN brute force** | 10K possible PINs, but bcrypt is ~100ms per check. Supabase API gateway rate limiting. Add lockout counter in V1.5 if observed. |
| **PIN hash exposure** | Column-level grants: anon can only SELECT `(id, name, origin_type, claimed_at, claimed_by_name, created_at)`. `claim_pin_hash` and `virwave_user_id` invisible to PostgREST for anon. |
| **Spam check-ins** | Rate limiting inside RPC: 1 per plushie per 10 min, 30 global per minute. Client-side throttle as UX complement. |
| **XSS via city/country** | JS input sanitization (strip HTML/control chars). CHECK constraints on field format/length. PostgREST returns JSON. |
| **SQL injection** | PostgREST RPC parameterizes all function arguments. No raw SQL from client. |
| **Email harvesting** | No email field in check-ins. Interest capture uses existing `/interest/` form with proper consent model. |
| **Location data as PII** | Privacy note on check-in form. GDPR erasure via support email. Plushie names are admin-set. |
| **Data exfiltration** | RLS + column-level grants. Anon can: SELECT public columns on `plushies`, SELECT on `plushie_checkins`, call 3 RPC functions. Nothing else. |

---

## 4. Supabase Client Expansion

Current `VWSupabase` (in `assets/js/supabase.js`) only has `insert()`. We need `select()` and `rpc()`.

```javascript
// select(table, queryString) — GET via PostgREST
// rpc(fnName, params) — POST to /rest/v1/rpc/<fnName>
```

The `rpc()` method is critical — all plushie writes go through Postgres functions, not direct table inserts.

---

## 5. Plushie Page Structure

### 5.1 File Layout

```
virwave-website/
  P/
    index.html          ← Plushie identity page (new)
  assets/
    js/
      plushie.js        ← Page logic (new)
      supabase.js       ← Add select() + rpc() methods (edit)
    css/
      styles.css        ← Add plushie-specific styles (edit)
```

### 5.2 Page Sections

```
┌─────────────────────────────────────────┐
│  Nav (minimal — logo + home link only)  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ ORIGIN HERO (dark, immersive) ────┐ │
│  │  Origin icon (emoji V1, art later) │ │
│  │  "Luna"                            │ │
│  │  "Born in the Ocean"               │ │
│  │  Origin backstory paragraph        │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ CLAIM (if unclaimed) ────────────┐  │
│  │  "Be the first to activate Luna!" │ │
│  │  Your name: [__________]          │ │
│  │  Set a 4-digit PIN: [____]        │ │
│  │  [ Activate This Plushie ]        │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ CURRENT LOCATION (if claimed) ──┐  │
│  │  📍 "Berlin, Germany"             │ │
│  │  "Last updated March 14, 2026"    │ │
│  │  [ Update Location ] button       │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ UPDATE FORM (expandable) ────────┐ │
│  │  PIN: [____]                      │ │
│  │  City: [__________]               │ │
│  │  Country: [dropdown ▼]            │ │
│  │  [ Save Location ]                │ │
│  │  Privacy note + report link       │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ TRAVEL HISTORY ─────────────────┐  │
│  │  ● Berlin, Germany — Mar 14       │ │
│  │  ● London, UK — Mar 1            │ │
│  │  ● Born — Feb 20                 │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ VIRWAVE CTA (soft) ─────────────┐  │
│  │  "Meet VirWave — breathe better"  │ │
│  │  [ Explore the App ] → /products  │ │
│  │  [ Join Early Access ] → /interest│ │
│  └────────────────────────────────────┘ │
│                                         │
│  Footer (report link)                   │
└─────────────────────────────────────────┘
```

### 5.3 Page States

| State | What's shown |
|-------|-------------|
| **Unclaimed** | Origin hero + claim form (name + PIN). Travel history shows only "Born — [created_at]". |
| **Claimed, no check-ins** | Origin hero + "Not yet placed" + update form. |
| **Claimed, has check-ins** | Origin hero + current location + update form + travel history. |
| **No `?id` param** | "Scan a VirWave plushie's QR code to see its story." + products link. |
| **Invalid/unknown ID** | "We couldn't find this plushie. It might not be activated yet." + products link. |
| **Network error** | "Couldn't load plushie data. Check your connection." + retry button. |
| **Wrong PIN** | "That PIN doesn't match. Please try again." |
| **Rate limited** | "This plushie was just updated. Please wait a few minutes." |

### 5.4 Origin Backstories (V1)

```javascript
var ORIGINS = {
  ocean: {
    icon: '🌊',
    title: 'Born in the Ocean',
    story: 'Born where the tide meets the shore. This companion learned to breathe with the rhythm of waves — slow in, steady out, endlessly patient. It carries the calm of deep water wherever it goes.'
  },
  forest: {
    icon: '🌲',
    title: 'Born in the Forest',
    story: 'Shaped under ancient canopy, where every breath is filtered through leaves and moss. This companion knows that stillness isn\'t silence — it\'s listening to everything at once and finding peace in the pattern.'
  },
  mountains: {
    icon: '⛰️',
    title: 'Born in the Mountains',
    story: 'Formed at altitude, where the air is thin and every breath is earned. This companion understands that the view from the top only matters if you paused long enough to see it.'
  },
  desert: {
    icon: '🏜️',
    title: 'Born in the Desert',
    story: 'Born in vast stillness, where the sky stretches endlessly and heat teaches patience. This companion knows that even in emptiness, there is rhythm — the slow pulse of sand and sun.'
  },
  savanna: {
    icon: '🦁',
    title: 'Born in the Savanna',
    story: 'Born under endless sky, where golden grass ripples like breath itself. This companion learned stillness from watching the horizon — patient, warm, alert to every shift in the wind.'
  }
};
```

---

## 6. Progressive Trust Roadmap

### V1 (shipping now) — PIN Claim + Soft CTA

- PIN-based claim and writes. Open reads.
- Soft CTA at page bottom → `/products/` and `/interest/`
- No email in check-ins. Interest via existing `/interest/` form.

### V1.5 (when app launches) — Optional Account Linking

- Warm prompt after weeks of PIN usage: "Connect [Luna] to VirWave"
- Account upgrades PIN, doesn't replace it.
- `plushies.virwave_user_id` populated.
- App gets "My Plushies" screen.
- Origin type unlocks matching atmosphere in app.

### V2 (mature ecosystem) — In-App Claim as Primary

- Scan QR in VirWave app → claimed via session.
- Web page is fallback for non-app users.
- Core-body pairing registration via app API.

**No additional schema migrations needed** for V1.5 or V2.

---

## 7. QR Code Generator Update

Extend `scripts/generate-qr.py` with plushie mode:

```bash
# Single plushie QR
python scripts/generate-qr.py --plushie K7MX2PAB

# Batch: generate N new UIDs + QR codes + SQL seed statements
python scripts/generate-qr.py --plushie-batch 10 --origin ocean --name-prefix "Wave"

# List all generated QR codes
python scripts/generate-qr.py --list
```

**Output:** QR images in `assets/qr/plushie/<UID>.png`, manifest entries, batch SQL seed statements.  
**URL:** `https://www.virwave.com/P/?id=K7MX2PAB`

---

## 8. Implementation Order

| Step | What | Files | Depends On |
|------|------|-------|------------|
| 1 | Supabase migration (tables + RLS + RPC + grants) | migration SQL | — |
| 2 | Apply migration + seed test data | Supabase CLI | 1 |
| 3 | Add `select()` + `rpc()` to Supabase client | `assets/js/supabase.js` | — |
| 4 | Create plushie page HTML | `P/index.html` | — |
| 5 | Create plushie page JS | `assets/js/plushie.js` | 2, 3 |
| 6 | Add plushie CSS | `assets/css/styles.css` | — |
| 7 | Update QR generator | `scripts/generate-qr.py` | 1 |
| 8 | End-to-end test | — | 2-6 |
| 9 | Generate David's QR codes | Script output | 7, 8 |

Steps 3, 4, 6, 7 run in parallel. Critical path: 1 → 2 → 5 → 8.

---

## 9. Out of Scope (V1)

- Admin panel (seed via SQL/script)
- Image upload
- User accounts / auth on web page
- Core-body pairing via web
- App deep-linking from QR scan
- Push notifications
- Internationalization
- PIN lockout counter (V1.5 if needed)

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| QR printed with wrong URL | High | Confirmed flexible. Lock `https://www.virwave.com/P/?id=<8-CHAR-UID>`. |
| PIN brute force | Medium | bcrypt slowness + API gateway rate limiting. Add lockout in V1.5 if observed. |
| PIN forgotten | Low | Report link → support email. Admin resets via SQL. Future: email-based reset. |
| Location data as PII | Medium | Privacy note, GDPR erasure via support, admin-controlled plushie names. |
| Plushie not in DB when scanned | Medium | Friendly error state. David seeds before shipping. |

---

## Appendix A: Country List

Static ISO 3166-1 alpha-2 list in `plushie.js` (~5KB). No external API. Searchable dropdown with type-ahead.

## Appendix B: Privacy Requirements

- Check-in form: "Location updates are publicly visible on this page. [Privacy Policy](/privacy/)"
- Privacy policy update: mention plushie location data collection + public display
- Report link: `mailto:hello@virwave.com?subject=Plushie%20Report%20<ID>`
- No email in check-in flow — interest via `/interest/` form with existing consent
