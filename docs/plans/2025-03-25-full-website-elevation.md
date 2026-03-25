# VirWave Website Full Elevation Plan

**Goal:** Transform the website from a functional dark-themed landing page into an award-worthy, immersive brand experience that makes visitors start breathing before they sign up.

**Architecture:** Three independent phases, each producing a committable, visually complete result. Phase A (typography + color) is CSS-only and unblocks the other two. Phase B (hero canvas) is a new JS module + HTML restructure. Phase C (section architecture) is HTML reorder + CSS layout diversity + SVG icons.

**Branch:** `feat/website-elevation` (existing)

**Reviewed by:** Independent principal app designer (Apple Design Award, Webby, Awwwards). Approved with conditions — all conditions incorporated below.

---

## New CSS Tokens (added in Phase A, used across all phases)

```css
:root {
  /* Named colors (no raw hex outside :root) */
  --navy-warm:   #0E3854;    /* hero gradient mid-tone */
  /* --bg-surface already exists as #111D2C */

  /* Typography color accents */
  --text-accent: var(--teal-light);

  /* Typography weights (3 only: reading, emphasis, wordmark) */
  /* 300 = reading voice, 600 = headings + buttons, 700 = wordmark only */
}
```

---

## Phase A: Typography & Color Life

**Time estimate:** 20 min
**Files:**
- Modify: `assets/css/styles.css`
- Modify: `index.html` (add section eyebrows, migrate hero sub-copy)

### Why Color in Typography

The designer said weight hierarchy is too flat (400/600 only). The user asked for "more colors to add life." The solution: a color-accent system at structural landmarks (eyebrows, step numbers, gradient headings) while keeping body text in the opacity-based white hierarchy. This matches how the app uses phase colors as accents on a neutral canvas.

### Changes

#### A1: Font weight consolidation (3 weights, not 4)

Per designer review — keep to 3 weights maximum on the homepage:
- **300** (light): Body text, card paragraphs, section subtitles — the "reading voice"
- **600** (semibold): All headings (h1-h6), buttons, nav links — the "emphasis voice"
- **700** (bold): Wordmark "VirWave" in `.nav-logo` only

Changes:
- `body { font-weight: 300; }` — light as primary reading voice
- `.nav-logo { font-weight: 700; }` — wordmark rule (was 600)
- `.btn { font-weight: 600; }` — consolidate from 500 to 600
- `.card p, .step p { font-weight: 300; }` — explicit reading voice
- `.hero h1 { font-weight: 600; }` — already correct

#### A2: Letter-spacing fixes
- `.nav-links a { letter-spacing: 0.08em; }` — tracked caps per visual language (was 0.02em)
- `.hero-eyebrow { letter-spacing: 0.08em; }` — was 0.12em (over-tracked)

#### A3: Type size + opacity bump for readability
- `.card p { font-size: var(--text-base); color: var(--text); }` — 16px at 85% opacity for WCAG AA on dark (was 14px at 60%)
- `.step p { font-size: var(--text-base); color: var(--text); }` — same treatment

#### A4: Section subtitle opacity fix
- `.section-header p { color: var(--text); }` — 85% opacity, not 60%. Subtitles are primary content, not secondary muted text. The `.section-eyebrow` (mint) sits above at full opacity; the subtitle below at 85%.

#### A5: Color accents at structural landmarks

**Section eyebrows**: Add `<p class="section-eyebrow">` above each `<h2>`. Styled:
```css
.section-eyebrow {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mint);
  margin-bottom: var(--sp-3);
}
```

Labels:
- "How it works" → `GET STARTED`
- "What it is" → `THE APP`
- "App Preview" → `THE EXPERIENCE`
- "Who it's for" → `INCLUSIVE`
- "Research" → `THE SCIENCE`
- "Blog" → `STORIES`
- "Contact" → `SAY HELLO`

**Step numbers**: Use phase colors sequentially:
- Step 1: `background: linear-gradient(135deg, var(--phase-inhale), var(--phase-hold))` (blue→violet)
- Step 2: `background: linear-gradient(135deg, var(--phase-hold), var(--phase-exhale))` (violet→mint)
- Step 3: `background: linear-gradient(135deg, var(--phase-exhale), var(--phase-rest))` (mint→grey)

**Hero h1 gradient text**: Subtle depth fade:
```css
.hero h1 {
  background: linear-gradient(180deg, var(--white) 0%, rgba(248,248,246,0.7) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

**Footer link hover**: `var(--mint)` instead of current `var(--teal-light)`.

#### A6: Content migration for trimmed hero sub-copy

The hero sub-copy gets trimmed to: "Breath won't fix your circumstances — but it can give you enough steadiness to act."

The removed content ("VirWave pairs guided breathwork with journaling and real human connection, so you can show up for yourself and the people who need you.") migrates to the "What is VirWave?" section subtitle, replacing the current: "A breathing companion that helps you get steady — so you can actually show up."

New subtitle: "Guided breathwork, journaling, and real human connection — so you can show up for yourself and the people who need you."

#### A7: Move raw hex into :root
- Replace `#0E3854` in hero gradient with `var(--navy-warm)`
- `#111D2C` is already `var(--bg-surface)` — use the variable in C7

#### A8: Commit
```
git add assets/css/styles.css index.html
git commit -m "feat: typography refinement — weight 300/600/700, color accents, section eyebrows"
```

---

## Phase B: Hero Canvas Atmosphere

**Time estimate:** 60 min
**Files:**
- Create: `assets/js/hero-canvas.js` (~180-220 lines)
- Modify: `index.html` (hero section restructure)
- Modify: `assets/css/styles.css` (hero layout, entrance animations, dead CSS cleanup)
- Modify: `assets/js/main.js` (scroll-out transition, buildThresholdArray helper)

### Design (from designer review "Approach D")

Single full-viewport `<canvas>` behind hero content. No mouse interaction. No parallax. Three composited layers:

1. **Background orbs** (2): Phase-blue and phase-violet radial gradients at 0.03-0.04 opacity, drifting on independent 40-60s sine curves. Create color temperature, not visible blobs.
2. **Breathing aura** (1): Radial gradient (teal center → mint mid → transparent edge) at ~65% from left, ~45% from top. Breathes on a **real cadence**: 4s inhale, 4s hold, 6s exhale, 2s rest (16s total). Scale: 0.97-1.03. Opacity: 0.04-0.08.
3. **Ambient particles** (8 desktop, 4 mobile): White dots, 0.03-0.07 opacity, sine-curve drift.

### Hero Layout: Asymmetric Split

```
Desktop (>768px):
┌─────────────────────────────────────────────────────┐
│                                                     │
│   [eyebrow]                          ╭─ aura ──╮   │
│   [h1 — large, left-aligned]        │ (canvas) │   │
│   [sub — max 560px]                  │  pulse   │   │
│   [CTA buttons]                      ╰─────────╯   │
│                                                     │
└─────────────────────────────────────────────────────┘

Mobile (<768px):
┌────────────────────┐
│   [eyebrow]        │
│   [h1 — centered]  │  Aura behind at
│   [sub]            │  reduced opacity
│   [CTAs]           │
└────────────────────┘
```

### Implementation

#### B1: Create `assets/js/hero-canvas.js`

Config object at top with all constants. The module:
- Initializes on DOMContentLoaded
- Reads `.hero` dimensions
- Renders 3 layers per frame via `requestAnimationFrame`
- **Uses `ctx.clearRect()` each frame** (NOT fillRect — canvas must be transparent so the CSS gradient shows through as progressive enhancement fallback)
- Uses `globalCompositeOperation = 'lighter'` for luminous blending of orbs/aura
- Checks `prefers-reduced-motion` — if true, renders one static frame and stops the loop
- Debounced resize handler
- Detects mobile via `canvas.width < 768` → reduces particles to 4

Breathing cadence state machine:
```javascript
var BREATH = {
  inhale:  4000,  // 4s — scale up, opacity up
  hold:    4000,  // 4s — hold at peak
  exhale:  6000,  // 6s — scale down, opacity down
  rest:    2000   // 2s — hold at trough
};
var TOTAL = 16000;
// Phase progress derived from: (Date.now() % TOTAL) / TOTAL
// Maps to eased scale (0.97-1.03) and opacity (0.04-0.08)
```

Budget: 180-220 lines. Do not compress for line count.

#### B2: Restructure hero HTML

Remove:
- `.hero-particles` (8 CSS particle spans) — replaced by canvas particles
- `.breathing-ring` (3 CSS ring divs + glow) — replaced by canvas aura

Add:
- `<canvas id="hero-canvas" aria-hidden="true"></canvas>` — first child of `.hero`

Hero content:
- Wrap `.hero-content` inside a `.container` div for scrollbar-safe alignment
- Left-aligned on desktop via `text-align: left` on the container
- Trimmed sub-copy (first sentence only — see A6 for content migration)

#### B3: Hero CSS updates

```css
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  /* NO justify-content: center or text-align: center */
  background: linear-gradient(165deg, var(--navy-deep) 0%, var(--navy) 40%, var(--navy-warm) 65%, var(--navy) 100%);
  color: var(--white-pure);
  overflow: hidden;
  padding: var(--sp-24) var(--sp-6);
}

#hero-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* Hero content inside .container for scrollbar-safe alignment */
.hero .container {
  width: 100%;
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 560px;
  /* Left-aligned within the container — no 100vw calc needed */
}

.hero-actions {
  justify-content: flex-start;
}

/* Mobile: center */
@media (max-width: 768px) {
  .hero-content {
    max-width: 100%;
    text-align: center;
  }
  .hero-actions { justify-content: center; }
}
```

#### B4: Staggered text entrance

```css
.hero-content > * {
  opacity: 0;
  transform: translateY(16px);
  animation: hero-entrance 350ms cubic-bezier(0.33, 1, 0.68, 1) forwards;
}
.hero-content > :nth-child(1) { animation-delay: 0ms; }    /* eyebrow */
.hero-content > :nth-child(2) { animation-delay: 150ms; }  /* h1 */
.hero-content > :nth-child(3) { animation-delay: 300ms; }  /* sub */
.hero-content > :nth-child(4) { animation-delay: 450ms; }  /* CTAs */

@keyframes hero-entrance {
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-content > * {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
  }
}
```

#### B5: Scroll-out transition

Add `buildThresholdArray` helper and hero fade-out to `main.js`:
```javascript
function buildThresholdArray(steps) {
  return Array.from({ length: steps + 1 }, function (_, i) { return i / steps; });
}
```

In `initScrollReveal()`:
```javascript
// Hero canvas fade-out on scroll
var hero = document.querySelector('.hero');
var heroCanvas = document.getElementById('hero-canvas');
if (hero && heroCanvas) {
  var heroObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      heroCanvas.style.opacity = entry.intersectionRatio;
    });
  }, { threshold: buildThresholdArray(20) });
  heroObserver.observe(hero);
}
```

#### B6: Clean up dead CSS

Remove from `styles.css` after B2:
- `.hero-particles` and `.particle` rules (replaced by canvas)
- `@keyframes particle-x` and `@keyframes particle-y`
- `.breathing-ring`, `.breathing-ring-glow`, `.breathing-ring-layer` rules
- `@keyframes ring-scale`, `@keyframes ring-color`, `@keyframes glow-pulse`
- Reduced-motion rules referencing `.breathing-ring-layer`, `.breathing-ring-glow`, `.hero-particles`

#### B7: Progressive enhancement

The CSS gradient remains as the base background. Canvas layers on top via `position: absolute`. If JS fails, the visitor sees the navy gradient, the text, and the buttons — fully functional. Canvas is purely atmospheric.

#### B8: Commit
```
git add assets/js/hero-canvas.js assets/css/styles.css index.html assets/js/main.js
git commit -m "feat: immersive hero — canvas atmosphere with breathing aura, asymmetric layout"
```

---

## Phase C: Section Architecture & Visual Diversity

**Time estimate:** 60 min
**Files:**
- Modify: `index.html` (section reorder, HTML restructure, SVG icons, dividers, trust strip)
- Modify: `assets/css/styles.css` (section-specific layouts, gradients, spacing, hover states)
- Modify: `assets/js/main.js` (extend scroll reveal selectors)

### Section Reorder

Current: Hero → What → Who → How → Research → Blog → Contact
New:     Hero → How → What → App Preview → Trust Strip → Who → Research → Blog → Contact

### C1: "How it works" — vertical timeline (position 2)

Replace horizontal 3-card grid with a left-aligned vertical timeline:

```html
<section class="section section-dark" data-section="how-it-works">
  <div class="container container-narrow">
    <div class="section-header section-header-left">
      <p class="section-eyebrow">GET STARTED</p>
      <h2>How it works</h2>
      <p>Three steps to steady your nervous system.</p>
    </div>
    <div class="timeline">
      <div class="timeline-step" data-phase="inhale">
        <div class="timeline-number">1</div>
        <div class="timeline-content">
          <h3>Choose your shape</h3>
          <p>Pick a breathing shape that feels right: box, circle, triangle, or more. Each one guides a different rhythm.</p>
        </div>
      </div>
      <div class="timeline-step" data-phase="hold">
        <div class="timeline-number">2</div>
        <div class="timeline-content">
          <h3>Set the mood</h3>
          <p>Select your color mood and rhythm speed. Make the experience yours: gentle, balanced, or deep.</p>
        </div>
      </div>
      <div class="timeline-step" data-phase="exhale">
        <div class="timeline-number">3</div>
        <div class="timeline-content">
          <h3>Breathe</h3>
          <p>Follow the fluid visual guide. Inhale, hold, exhale, rest. Let the shape lead and your nervous system settle.</p>
        </div>
      </div>
    </div>
  </div>
</section>
```

CSS:
```css
.container-narrow { max-width: 720px; }
.section-header-left { text-align: left; }
.section-header-left p { margin: 0; } /* no auto-center */

.timeline {
  position: relative;
  padding-left: var(--sp-12);
  border-left: 2px solid rgba(255,255,255,0.06);
}

.timeline-step {
  position: relative;
  padding-bottom: var(--sp-12);
}
.timeline-step:last-child { padding-bottom: 0; }

.timeline-number {
  position: absolute;
  left: calc(var(--sp-12) * -1 - 20px);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--white-pure);
}
/* Phase colors per step */
[data-phase="inhale"] .timeline-number { background: linear-gradient(135deg, var(--phase-inhale), var(--phase-hold)); }
[data-phase="hold"]   .timeline-number { background: linear-gradient(135deg, var(--phase-hold), var(--phase-exhale)); }
[data-phase="exhale"] .timeline-number { background: linear-gradient(135deg, var(--phase-exhale), var(--phase-rest)); }

.timeline-content h3 { margin-bottom: var(--sp-2); }
.timeline-content p { color: var(--text); font-size: var(--text-base); }

/* Timeline hover */
@media (hover: hover) {
  .timeline-step:hover .timeline-number {
    box-shadow: 0 0 16px rgba(10, 126, 164, 0.2);
  }
}

/* Mobile: remove border, stack with circles */
@media (max-width: 768px) {
  .timeline {
    padding-left: 0;
    border-left: none;
  }
  .timeline-step { text-align: center; padding-bottom: var(--sp-10); }
  .timeline-number {
    position: static;
    margin: 0 auto var(--sp-4);
  }
}
```

### C2: "What is VirWave?" — horizontal icon-left cards (position 3)

```css
.card-horizontal {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: var(--sp-4);
  align-items: start;
}
.card-horizontal .card-icon { margin-bottom: 0; }

/* Hover */
@media (hover: hover) {
  .card-horizontal:hover {
    transform: translateY(-2px);
    border-color: rgba(10, 126, 164, 0.3);
    box-shadow: 0 0 20px rgba(10, 126, 164, 0.15);
  }
}
```

### C3: App Preview section (NEW, position 4)

Phone mockup with CSS breathing aura inside:

```html
<section class="section" data-section="app-preview">
  <div class="container">
    <div class="section-header">
      <p class="section-eyebrow">THE EXPERIENCE</p>
      <h2>Designed to feel like nothing else</h2>
      <p>A breathing experience that's as beautiful as it is effective.</p>
    </div>
    <div class="phone-frame">
      <div class="phone-screen">
        <div class="app-demo-aura"></div>
        <div class="app-demo-labels" aria-hidden="true">
          <span class="app-demo-label" data-phase="inhale">Inhale</span>
          <span class="app-demo-label" data-phase="hold">Hold</span>
          <span class="app-demo-label" data-phase="exhale">Exhale</span>
          <span class="app-demo-label" data-phase="rest">Rest</span>
        </div>
      </div>
    </div>
  </div>
</section>
```

CSS: Phone frame `300px x 650px`, `border-radius: 40px`, `border: 2px solid rgba(255,255,255,0.12)`, centered. The `.app-demo-aura` is a radial gradient breathing on the 16s cadence. Phase labels are 4 stacked spans, absolutely positioned, cycling via opacity keyframes.

Phase label keyframe math (unequal durations on 16s cycle):
- Inhale (0%-25%): `0% { opacity: 1 } 25% { opacity: 1 } 25.1% { opacity: 0 }`
- Hold (25%-50%): `24.9% { opacity: 0 } 25% { opacity: 1 } 50% { opacity: 1 } 50.1% { opacity: 0 }`
- Exhale (50%-87.5%): `49.9% { opacity: 0 } 50% { opacity: 1 } 87.5% { opacity: 1 } 87.6% { opacity: 0 }`
- Rest (87.5%-100%): `87.4% { opacity: 0 } 87.5% { opacity: 1 } 100% { opacity: 1 }`

Section glow: `::after` pseudo-element with radial teal gradient at 0.04 opacity behind the phone frame.

### C4: Trust strip (between App Preview and "Who it's for")

```html
<div class="trust-strip">
  <p>Built at <strong>UCL Hatchery</strong> &middot; Evidence-informed &middot; Coming 2026</p>
</div>
```

```css
.trust-strip {
  text-align: center;
  padding: var(--sp-8) var(--sp-6);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.trust-strip strong { color: var(--text); }
```

### C5: "Built for every kind of mind" — staggered 2-column (position 5)

Use `transform: translateY` instead of negative margins (more robust):

```css
.card-grid-staggered {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-8);
}
.card-grid-staggered > :nth-child(even) {
  transform: translateY(var(--sp-12));
}

@media (max-width: 768px) {
  .card-grid-staggered {
    grid-template-columns: 1fr;
  }
  .card-grid-staggered > :nth-child(even) { transform: none; }
}
```

### C6: "Grounded in research" — accent-bar cards with phase colors

Each card gets a different phase-color accent bar (echoes the step number treatment):

```css
.card-research {
  border-left: 3px solid var(--teal);
  background: rgba(255,255,255,0.03);
  padding-left: var(--sp-6);
  backdrop-filter: none; /* more recessed */
}
.card-research:nth-child(1) { border-left-color: var(--teal); }      /* Evidence */
.card-research:nth-child(2) { border-left-color: var(--phase-hold); } /* Nervous system */
.card-research:nth-child(3) { border-left-color: var(--mint); }       /* Learning */

.card-research h3 { font-size: var(--text-base); font-weight: 600; }

/* Hover */
@media (hover: hover) {
  .card-research:hover {
    background: rgba(255,255,255,0.05);
    transform: translateX(4px); /* subtle rightward shift instead of lift */
  }
}
```

### C7: SVG icons (replace all emoji)

Six inline SVGs from Lucide (MIT license), 24x24, 1.5px stroke, `currentColor`:
- Guided Breathing: `activity` (wave pulse line)
- Personal Journal: `book-open` (open book)
- Connections: `users` (two people)
- Evidence: `microscope`
- Nervous System: `brain`
- Learning: `lightbulb`

SVGs inlined directly in HTML. Each is ~3-5 lines of path data.

### C8: Section visual variety — gradient depth shifts

```css
[data-section="how-it-works"] {
  background: linear-gradient(180deg, var(--navy-deep) 0%, var(--navy) 100%);
}

[data-section="app-preview"] {
  background: radial-gradient(ellipse 60% 40% at 50% 50%,
    rgba(10, 126, 164, 0.04) 0%, var(--navy) 70%);
}

[data-section="who-its-for"] {
  background: var(--navy-deep);
}

[data-section="credibility"] {
  background: var(--bg-surface);
}
```

### C9: Spacing variation

```css
/* Primary content sections: 128px breathing room */
[data-section="how-it-works"],
[data-section="what-it-is"],
[data-section="who-its-for"],
[data-section="app-preview"] {
  padding-top: calc(var(--sp-24) + var(--sp-8));
  padding-bottom: calc(var(--sp-24) + var(--sp-8));
}

/* Lighter sections: 96px */
[data-section="blog-preview"],
[data-section="contact"] {
  padding-top: var(--sp-24);
  padding-bottom: var(--sp-24);
}
```

### C10: Section dividers

```css
.section-divider {
  width: 40%;
  max-width: 400px;
  height: 1px;
  margin: 0 auto;
  background: linear-gradient(90deg, transparent, var(--teal), transparent);
  opacity: 0.20; /* bumped from 0.15 for visibility on dark monitors */
}
```

Place between:
- Hero and "How it works"
- App Preview/trust strip and "Who it's for"
- Research and Blog

### C11: Update scroll reveal selectors

In `main.js`, extend the `initScrollReveal()` target selector:
```javascript
var targets = document.querySelectorAll(
  '.section-header, .card, .card-horizontal, .card-research, .timeline-step, .phone-frame, .trust-strip, .blog-card, .contact-buttons'
);
```

### C12: Commit
```
git add index.html assets/css/styles.css assets/js/main.js
git commit -m "feat: section architecture — reorder, timeline, app preview, staggered grid, SVG icons"
```

---

## Phase Dependency Graph

```
A (typography + color)
├── B (hero canvas) — depends on A for color tokens + --navy-warm
└── C (sections) — depends on A for typography + eyebrow styles
```

A must be done first. B and C are independent of each other and can be parallelized.

## Verification After Each Phase

- `python3 -m http.server 8000` → check in browser
- Desktop (1440px), tablet (768px), mobile (375px)
- Chrome DevTools > Rendering > Emulate `prefers-reduced-motion: reduce`
- Verify interest form, blog, products, legal pages still look correct (shared styles.css)
- Visual QA: `bash scripts/capture-screenshot.sh --all-viewports`

## Implementation Notes (from designer review)

1. Canvas MUST use `clearRect()` not `fillRect()` — transparency lets the CSS gradient show through
2. Hero content alignment uses `.container` wrapper, NOT `calc(100vw - ...)` (scrollbar-safe)
3. Phase label keyframe math requires careful percentage calculation for unequal durations
4. Test section dividers at 0.20 opacity on multiple monitors — increase if invisible
5. `buildThresholdArray()` helper must be created in main.js for hero scroll-out
6. Dead CSS from `.breathing-ring` and `.hero-particles` must be cleaned up in B6

## What This Does NOT Include (deferred)

- Testimonials / user quotes (no quotes available yet)
- Waitlist value prop section (needs product decision on incentives)
- Full-bleed app screenshots (need production app screenshots)
- Blog and products page redesign (different scope)
