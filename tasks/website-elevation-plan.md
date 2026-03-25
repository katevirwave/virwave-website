# VirWave Website Elevation Plan

**Date:** 2026-03-25
**Time budget:** 2 hours
**Constraint:** Event in 2 hours. Another agent is updating interest form logic. GitHub Pages hosting (no build step). Must not break anything.

## Problem

The website looks generic — it doesn't reflect VirWave's brand identity (glassmorphism, breathing motion, calm luxury, editorial quality). The app has a rich design system (tokens, glass tiers, motion language, phase colors) that the website barely uses.

## Strategy: CSS-Only Elevation (No Framework Migration)

Keep the static HTML/CSS/JS stack. No Vercel migration. No build step. Pure CSS + vanilla JS enhancements that deploy instantly via git push to GitHub Pages.

**Why this is right for today:**
- Zero risk of breaking the build pipeline (there is none)
- Instant deployment (push to main = live)
- Another agent is touching `interest/index.html` and `supabase.js` — we avoid those files
- Changes are purely visual — no logic changes

## Architectural Decision: Go Full Dark

**All sections become dark-navy.** Light sections (`section-alt` with `#F2F2F0`) get converted to dark variants. Reason: glassmorphism is invisible on light backgrounds. The app is dark-first — the website should match. This is a product decision, not a cosmetic one.

- `section` (default) → navy `#0D2137`
- `section-dark` → deep navy `#091826`
- `section-alt` → eliminated, replaced with navy + subtle teal tint
- All text becomes light (white at various opacities)
- Cards use glass tiers on dark backgrounds where they actually work

## Agent Execution Notes (from review)

Critical instructions for the executing agent:

1. **Glass on dark only.** Never apply `backdrop-filter: blur()` on light backgrounds — it's invisible. All sections must be dark before glass cards are applied.
2. **`::before` is taken on `.hero`.** The hero already has a `::before` pseudo-element with a radial gradient. Use explicit `<div class="breathing-ring">` markup for the breathing animation, not pseudo-elements.
3. **Particle opacity goes DOWN, not up.** Current particles are 0.13-0.22 opacity. Reduce to 0.04-0.09 to match the app. The word "enhance" means "refine to brand spec."
4. **Max blur 10px on cards.** `backdrop-filter: blur(20px)` causes GPU jank on mid-range Android. Use blur(8px) for cards, blur(12px) max for nav only.
5. **Don't load Inter font.** The system font stack (`-apple-system, BlinkMacSystemFont, Segoe UI`) is correct and avoids font-load latency. Don't add a Google Fonts link.
6. **Scope new dark styles under classes.** Don't apply global dark styles that leak into the interest form. Use `.section-dark`, `.glass-card`, etc. The shared `styles.css` affects all pages including `/interest/`.
7. **`initScrollReveal()` goes inside existing `init()` after `applyVisibility()`.** Not in a separate `DOMContentLoaded` listener — that would flash hidden sections.
8. **Consolidated `prefers-reduced-motion` block.** Cover ALL animations: breathing ring, particles, scroll reveals, hover transitions, button scales. One media query block at the end of the stylesheet.
9. **Hero gradient should end dark.** Extend to end at `#0D2137` (navy) at 100%, not `#0A7EA4` (teal). The breathing ring colors clash against teal.
10. **`section-dark .card` already has basic glass** (`rgba(255,255,255,0.05)` bg, `rgba(255,255,255,0.08)` border). Don't overwrite with identical values — only meaningful upgrades.
11. **Don't add `data-phase` to existing `data-section` attributes** — those are used by the visibility system. Use separate `data-phase` attributes or classes.
12. **Can't glow emoji.** Cards use emoji icons (`🌊`, `📓`, etc.). CSS text-shadow on emoji is unreliable. Skip icon glows unless converting to SVG (out of scope today).

## Phase 1: Dark Foundation + Hero (30 min)

### 1.1 Convert All Sections to Dark
- All sections get navy backgrounds with slight variation for visual rhythm
- Default section: `#0D2137`
- Alt sections: `#111D2C` (slightly lighter navy for contrast)
- Dark sections: `#091826` (deepest)
- All body text: `rgba(248, 248, 246, 0.85)` — warm off-white at 85%
- Headings: `rgba(248, 248, 246, 1.0)` — full white
- Secondary text: `rgba(248, 248, 246, 0.6)`

### 1.2 Dark Immersive Hero
- Replace current hero gradient: `#091826` → `#0D2137` → `#0D2137` (end dark, not teal)
- Full-viewport hero with centered content
- Add `<div class="breathing-ring">` markup with 3 nested ring elements
- CSS-only breathing ring: 3 concentric rings at 1.12x, 1.35x, 1.60x scale
- Phase colors cycling: inhale `#60A5FA`, hold `#A78BFA`, exhale `#8CEBAA`
- 16-second full cycle (4s per phase × 4 phases)
- `prefers-reduced-motion`: static rings, no animation, 50% opacity

### 1.3 Glassmorphism Cards (dark sections only)
- Subtle glass (default cards): `rgba(255,255,255,0.06)` bg, `rgba(255,255,255,0.08)` border, `blur(8px)`
- Medium glass (featured cards): `rgba(255,255,255,0.12)` bg, `rgba(255,255,255,0.18)` border, `blur(8px)`
- Strong glass (CTA cards): `rgba(255,255,255,0.20)` bg, `rgba(255,255,255,0.30)` border, `blur(10px)`

### 1.4 Typography Refinement
- Opacity-based hierarchy (see 1.1 text colors)
- Section label treatment: `text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; font-size: var(--text-sm)`
- Body: weight 400 (not 300 — 300 is too thin on screens)
- Headings: weight 600
- Max 2 weights per section

## Phase 2: Motion & Polish (45 min)

### 2.1 Scroll Reveal Animations
- IntersectionObserver + CSS transitions in vanilla JS
- Add inside existing `init()` function, after `applyVisibility()`
- Elements start with `opacity: 0; transform: translateY(20px)`
- On intersection: `opacity: 1; transform: translateY(0)`
- Duration: 350ms, easing: `cubic-bezier(0.33, 1, 0.68, 1)`
- Staggered delays for card grids: 100ms between cards
- `prefers-reduced-motion`: instant appearance, no transform

### 2.2 Particle Refinement
- Reduce particle count to 8
- Reduce opacity to 0.04-0.09 (from current 0.13-0.22)
- Slow drift: 30-60s animation cycles
- Slight size variation (2-5px)
- Confined to hero section
- `prefers-reduced-motion`: particles hidden entirely

### 2.3 Hover & Interaction States
- Cards: `transform: translateY(-2px)` + teal border glow (`box-shadow: 0 0 20px rgba(10,126,164,0.15)`)
- Primary buttons: mint glow on hover (`box-shadow: 0 0 24px rgba(140,235,170,0.3)`)
- Secondary buttons: scale(1.02) with 200ms ease
- All transitions: 200ms `cubic-bezier(0.33, 1, 0.68, 1)`

### 2.4 Section Transitions
- Replace hard color breaks with gradient blends between sections
- Subtle teal glow divider between major sections (1px line with box-shadow)
- No harsh borders

## Phase 3: Finishing Touches (30 min) — Scoped Down

### 3.1 Footer Polish
- Glass footer on deepest navy (`#091826`)
- Teal hover glow on social/contact links
- Clean spacing, 8pt grid

### 3.2 Consolidated Reduced Motion
- Single `@media (prefers-reduced-motion: reduce)` block at end of stylesheet
- Covers: breathing ring, particles, scroll reveals, hover transitions, button animations
- Sets `transition-duration: 0.01ms !important` on all animated elements
- Breathing ring: visible but static
- Particles: `display: none`

### 3.3 Mobile Polish
- Breathing ring scales down on mobile (max 200px diameter on small screens)
- Card grid single-column maintains glass treatment
- Hover states don't apply on touch (use `@media (hover: hover)` guard)
- Touch targets remain 48pt minimum

**Deferred to future session:**
- Phase color accents per section (3.2 from original plan)
- Per-card accent color hover pulses (needs SVG icons first)
- Footer tagline (already appears in hero — would be repetitive)

## Files We Touch (Scoped)

| File | Changes | Risk |
|------|---------|------|
| `assets/css/styles.css` | All visual changes | Low — CSS only, scoped under classes |
| `assets/js/main.js` | IntersectionObserver for scroll reveal | Low — additive, inside existing init() |
| `index.html` | Breathing ring markup, section class updates | Low — structural only |

**Files we DO NOT touch** (another agent's territory):
- `interest/index.html`
- `assets/js/supabase.js`
- `_supabase.json`

## Workflow

1. **Branch:** `feat/website-elevation` off current `main`
2. **Stash** any uncommitted website changes first
3. **Agent executes** phases 1-3 sequentially
4. **Visual QA:** Sebastian reviews in browser after each phase
5. **Merge:** Fast-forward merge to main when approved → auto-deploys to GitHub Pages

## Workspace Decision

**Recommendation: Add a CLAUDE.md to virwave-website, keep it as a separate workspace.**

Reasons:
- The website is a different repo, different tech stack (HTML/CSS vs React Native), different deployment
- virwave_v3's agent setup (EAS builds, Expo, Reanimated skills) would confuse agents working on the website
- The brand identity can be encoded in the website's own CLAUDE.md (copy the relevant tokens, voice, constraints)
- VS Code multi-root workspace already works — agents in virwave_v3 can reference the website via the additional working directory

What to put in `virwave-website/CLAUDE.md`:
- Brand tokens (colors, glass tiers, typography, spacing)
- Voice & messaging guidelines
- Design constraints (dark-first, glassmorphism, no harsh animations)
- File structure guide
- Deployment info (GitHub Pages, push to main = live)
- Reference to virwave_v3 for brand source of truth

## Success Criteria

After 2 hours, the website should:
1. Feel like it belongs to the same brand as the app (dark, glass, calm)
2. Have a breathing animation in the hero that no competitor has
3. Scroll smoothly with reveal animations
4. Respect reduced motion preferences
5. Deploy without breaking anything
6. Not conflict with the other agent's interest form work
