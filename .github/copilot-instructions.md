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

## Agent Tips (VS Code)

- **Figma and Make links should trigger the Figma MCP workflow**: Read `../virwave_v3/docs/setup/FIGMA_MCP.md` and use it before inventing UI manually.
- **Open Paper files should trigger the Paper MCP workflow**: Read `../virwave_v3/docs/setup/PAPER_MCP.md` and use Paper for live design context and incremental canvas edits.
- **21st.dev for component inspiration**: Read `../virwave_v3/docs/setup/21ST_DEV_MCP.md`. Use `21st_magic_component_inspiration` for layout and interaction reference before building new sections. Never import npm packages — adapt to vanilla JS/CSS.
- **Convert outputs to website conventions**: Treat Figma MCP or Paper-derived implementation guidance as reference only. Rebuild it as semantic HTML, scoped CSS in `assets/css/styles.css`, and vanilla JS when needed.
- **Retry on the concrete frame**: If Figma context fails on a page root or selection-like node, fetch structure first and retry on the real frame/component node.
- **Use Paper incrementally**: Start with file context and selection, make small changes, and screenshot the result during the build instead of batching everything.
- **UI review**: Request screenshots via image carousel after CSS changes. Click any attachment to open the full image viewer with viewport comparison.
- **Session forking**: Fork the conversation before touching `assets/css/styles.css` for major layout changes — easy rollback if the glassmorphism or grid work goes wrong.
- **Nested subagents**: Use the Explore subagent to cross-reference brand tokens from `../virwave_v3/src/theme/tokens.ts` without leaving the main context.
- **`/troubleshoot`**: Diagnose agent debug logs — now works for Copilot CLI sessions too.

## Verification

After changes: serve locally (`python3 -m http.server 8000`), check mobile viewport, verify reduced motion behavior.

## Reference

Brand source of truth: `../virwave_v3/src/theme/tokens.ts` and `../virwave_v3/docs/design/DESIGN_SYSTEM.md`
