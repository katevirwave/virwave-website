# VirWave Website — Copilot Instructions

## Context

VirWave is a breathing/meditation app. This repo is the marketing website.
Static HTML/CSS/JS on GitHub Pages. No build step, no npm, no framework.

Agents are the primary workforce — design for autonomous execution with clear verification.

## Architecture

Single-file CSS (`assets/css/styles.css`), vanilla JS, semantic HTML.
Push to `main` = production deploy via GitHub Pages.

### Key Files

| File | Purpose |
|------|---------|
| `assets/css/styles.css` | All styles — CSS custom properties, responsive, accessible |
| `assets/js/main.js` | Navigation, visibility system, scroll behavior |
| `assets/js/supabase.js` | PostgREST client for form submissions |
| `_config.json` | Section/page visibility (hide without code changes) |
| `_supabase.json` | Supabase connection config (anon key, RLS-protected) |

## Brand Rules

### Colors (CSS Custom Properties)

- Primary: `--teal` (#0A7EA4), `--mint` (#8CEBAA), `--navy` (#0D2137)
- Dark-first design. Never pure white (#FFF) or pure black (#000).
- All colors via CSS variables. No raw hex outside `:root`.

### Glass Tiers (Dark Backgrounds Only)

```css
.glass-subtle  { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(8px); }
.glass-medium  { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); backdrop-filter: blur(8px); }
.glass-strong  { background: rgba(255,255,255,0.20); border: 1px solid rgba(255,255,255,0.30); backdrop-filter: blur(10px); }
```

Glass is invisible on light backgrounds. Only use on navy/dark sections.

### Typography

System font stack (no web font loading). Max 2 weights per section: 400 + 600.
Hierarchy through opacity: headings 100%, body 85%, muted 60%.

### Motion

- Gentle: 350ms `cubic-bezier(0.33, 1, 0.68, 1)` — transitions, reveals
- Snappy: 200ms same easing — hover, press, toggle
- Always respect `prefers-reduced-motion`
- No harsh animations, no flashes, sensory-safe

### Spacing

8pt grid: `--sp-1` (0.25rem) through `--sp-24` (6rem).
Container: 1120px max. Touch targets: 48px minimum.

## Constraints

1. No npm dependencies, no build tools, no JS frameworks
2. No web fonts (system stack only)
3. No raw hex outside `:root` — use CSS custom properties
4. No glassmorphism on light backgrounds
5. `data-section` attributes are functional (visibility system) — don't repurpose for styling
6. Accessibility: WCAG AA contrast, semantic HTML, `prefers-reduced-motion` support
7. Scope CSS under classes — shared stylesheet affects all pages including `/interest/`
8. Never force-push `main` — it's the production branch

## Voice

- Tagline: "Regulate Yourself. Rise for Others."
- Plain language, inclusive, calm. No guilt, no guru energy, no clinical jargon.
- Neurodivergent-affirming by default.

## Verification

After changes: serve locally (`python3 -m http.server 8000`), check mobile viewport, verify reduced motion behavior.

## Reference

Brand source of truth: `../virwave_v3/src/theme/tokens.ts` and `../virwave_v3/docs/design/DESIGN_SYSTEM.md`
