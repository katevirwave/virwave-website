# VirWave Website — Agent Instructions

## What This Is

Marketing and product website for VirWave, a breathing and wellness app.
Static HTML/CSS/JS on GitHub Pages. No build step, no framework, no npm.
Custom domain: virwave.com. Push to `main` = live.

## Agent Operating Model

Agents are the primary workforce. Sebastian orchestrates and does visual QA. This follows the agent-first model from the global CLAUDE.md. Self-sufficiency expected — diagnose and fix, only escalate for product decisions, visual QA, irreversible actions, or security changes.

## Tech Stack

| Layer   | Tool                     | Notes                                         |
| ------- | ------------------------ | --------------------------------------------- |
| Markup  | HTML5                    | Semantic, accessible                          |
| Styles  | CSS3 + custom properties | Single file: `assets/css/styles.css`          |
| JS      | Vanilla ES6              | No framework, no jQuery, no npm               |
| Backend | Supabase PostgREST       | Form submissions, file uploads, RLS-protected |
| Hosting | GitHub Pages             | Deploy from `main` branch, root directory     |
| Blog    | Client-side markdown     | Custom parser in `assets/js/markdown.js`      |

**No build step.** No bundler, no transpiler, no package.json. Files serve directly.

## Affiliate Portal (`portal/`)

A **separate Next.js 14 App Router** app lives at `portal/`. It is **not** part of the static site — it has its own `package.json`, build step, and Vercel deployment.

- **URL:** `affiliates.virwave.com` (separate Vercel project, root directory: `portal/`)
- **Dev:** `cd portal && npm run dev`
- **Build:** `cd portal && npm run build`
- **Deploy:** Vercel project pointed at `portal/` subdirectory; or `cd portal && vercel --prod`
- **Env:** `portal/.env.local` (gitignored) — see `.env.local.example`

Do not add portal files to the static site root. Do not run `npm install` at the repo root.

## AIKEI App (`aikei-app/`)

A **separate TanStack Start (React 19 + Vite) SSR app** lives at `aikei-app/`. Like
`portal/`, it is **not** part of the static site — own `package.json`, own build,
own Vercel project.

- **Source:** exported from the Lovable project "Release Challenge"
- **URL:** `aikei.virwave.com` (separate Vercel project, root directory: `aikei-app/`)
- **Dev:** `npm --prefix aikei-app run dev` (or the `aikei-app` entry in `.claude/launch.json`)
- **Build:** `cd aikei-app && NITRO_PRESET=vercel npm run build` → `.vercel/output/`
- **Renders:** a three.js/React Three Fiber globe, an interactive 23-node system map,
  and a mascot video. This is why it is an app and not a static page.

Assets that Lovable stores on its CDN (logo, mascot mp4/webm) are vendored into
`aikei-app/public/media/`; the `src/assets/*.asset.json` files point at those local
paths so the app has no runtime dependency on Lovable.

Do not add app files to the static site root. Do not run `npm install` at the repo root.

## File Structure

```
/
├── index.html                  # Homepage
├── interest/index.html         # Interest/sign-up form
├── products/index.html         # Product grid
├── blog/                       # Blog system (client-side rendered)
├── privacy/, terms/            # Legal pages
├── assets/
│   ├── css/styles.css          # ALL styles (single file)
│   ├── js/main.js              # Nav, visibility, smooth scroll
│   ├── js/supabase.js          # PostgREST client
│   ├── js/blog.js              # Blog rendering
│   └── js/markdown.js          # Markdown parser
├── scripts/                    # QR generator, utilities
├── _config.json                # Visibility system config
├── _supabase.json              # Supabase connection (anon key, RLS)
├── CNAME                       # Custom domain: virwave.com
└── .nojekyll                   # Prevent Jekyll processing
```

## Brand Identity

VirWave is dark-themed, animation-rich, calm luxury, neurodivergent-affirming.
The app (virwave_v3) is the source of truth for brand. Key reference files:

- `../virwave_v3/src/theme/tokens.ts` — authoritative design tokens
- `../virwave_v3/docs/design/DESIGN_SYSTEM.md` — design system docs
- `../virwave_v3/docs/design/VISUAL_LANGUAGE.md` — emotional/aesthetic anchor

### Color Palette

```css
/* Brand */
--navy: #0d2137 /* Dark background */ --navy-deep: #091826 /* Deepest dark */
  --teal: #0a7ea4 /* Primary brand — trust, calm authority */ --mint: #8cebaa
  /* Interactive accent — warmth, completion */
  /* Phase colors (breathing emotional cues) */ Inhale: #60a5fa
  /* Airy blue — expansion */ Hold: #a78bfa /* Violet — stillness */
  Exhale: #8cebaa /* Mint — release */ Rest: #94a3b8 /* Cool grey — recovery */
  /* Neutrals */ --white: #f8f8f6 /* Warm off-white (never pure #FFF) */
  --off-white: #f2f2f0 --black: #11181c /* Warm dark (never pure #000) */;
```

### Glassmorphism (Dark Backgrounds Only)

Glass is invisible on light backgrounds. Only apply on navy/dark sections.

| Tier   | Background               | Border                   | Blur | Usage                       |
| ------ | ------------------------ | ------------------------ | ---- | --------------------------- |
| Subtle | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.08)` | 8px  | Ambient layers, backgrounds |
| Medium | `rgba(255,255,255,0.12)` | `rgba(255,255,255,0.18)` | 8px  | Cards, content surfaces     |
| Strong | `rgba(255,255,255,0.20)` | `rgba(255,255,255,0.30)` | 10px | CTAs, interactive elements  |

Max blur: 10px on cards (performance). 12px on nav only.

### Typography

- Font: system stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`). Don't load web fonts.
- Hierarchy through opacity, not weight: headings 100%, body 85%, secondary 60%
- Max 2 font weights per section: 400 (body) + 600 (headings)
- Section labels: `text-transform: uppercase; letter-spacing: 0.08em`

### Motion

Two personalities (never mixed):

- **Gentle** (350ms, `cubic-bezier(0.33, 1, 0.68, 1)`) — page transitions, scroll reveals, breathing
- **Snappy** (200ms, same easing) — button press, hover, toggle

Rules:

- No hard cuts — everything crossfades or eases
- No linear easing on loops
- `prefers-reduced-motion`: instant appearance, no animation, particles hidden
- Sensory safety > spectacle

### Spacing

8pt grid via CSS custom properties (`--sp-1` through `--sp-24`).
Container max-width: 1120px. Hit targets: 48px minimum.

## Design Constraints

1. **Dark-first.** Navy backgrounds, light text. The app is dark — the website matches.
2. **Glass on dark only.** `backdrop-filter` is invisible on light backgrounds.
3. **No hex colors outside `:root`.** Use CSS custom properties everywhere.
4. **No raw `rgba()` in components.** Define glass tiers as CSS classes.
5. **No raw border-radius numbers.** Use `--radius` (8px) or `--radius-lg` (12px).
6. **No harsh animations.** Everything calm, deliberate, sensory-safe.
7. **Reduced motion support.** Consolidated `@media (prefers-reduced-motion)` block.
8. **Accessibility baseline.** WCAG AA contrast, semantic HTML, aria labels, keyboard nav.
9. **No framework migration.** Stay static HTML/CSS/JS. GitHub Pages, no build step.
10. **Scope styles.** Use classes, not global selectors. Shared stylesheet affects all pages.

## Visibility System

`_config.json` controls what's shown without touching HTML:

- `hiddenSections` — hides elements with `data-section="key"`
- `hiddenNav` — hides nav items with `data-nav="key"`
- `hiddenPages` — redirects visitors from paths back to home

Don't repurpose `data-section` attributes for styling — they're functional.

## Voice & Messaging

- **Tagline:** "Regulate Yourself. Rise for Others."
- **Subtitle:** "Breathe first. Then move."
- Warm, plain language. Never preachy, never clinical, never guru-energy.
- Inclusive tone. Neurodivergent-affirming. No guilt mechanics.
- Evidence-informed but approachable.

## Verification

- Open in browser after changes: `python3 -m http.server 8000` or `npx serve .`
- Check mobile viewport (Chrome DevTools responsive mode)
- Check `prefers-reduced-motion` behavior (Chrome DevTools > Rendering > Emulate)
- Validate HTML: no broken links, no missing alt text

## Don'ts

- Don't add npm/node dependencies. This is a zero-dependency static site.
- Don't add a build step (Vite, webpack, etc.). Files serve directly.
- Don't use JavaScript frameworks (React, Vue, etc.).
- Don't add web fonts via Google Fonts links (system fonts only).
- Don't use raw hex colors outside `:root` CSS variables.
- Don't apply glassmorphism on light backgrounds (it's invisible).
- Don't use `data-section` attributes for styling (used by visibility system).
- Don't touch `_supabase.json` without understanding RLS implications.
- Don't force-push main (it's the production deploy branch).
- Don't summarize what you did. Sebastian can read the diff.

## Deployment

Push to `main` → GitHub Pages deploys automatically. Custom domain `virwave.com` via CNAME file.
`.nojekyll` prevents Jekyll from processing `_config.json` and `_supabase.json` as Jekyll config.

## Session Memory

After any correction: append the lesson to `tasks/lessons.md` immediately. Write a rule that prevents the mistake — not a description of what happened.

## Reference Projects

The workspace includes reference folders (read-only for brand context):

- **virwave_v3** — The app. Source of truth for brand tokens, design system, voice.
- **virwave_api** — Legacy backend. Some useful ideas for API patterns and Supabase schema, but not actively maintained.

## UI Design Workflow

Design quality stack for building and improving virwave.com:

**Tools:**

- **Figma MCP** (`figma` server) — use for design context, Make resource extraction, write-to-canvas, code-to-canvas, and Code Connect-aware implementation. Read `../virwave_v3/docs/setup/FIGMA_MCP.md` first. Treat returned React+Tailwind as reference and adapt it to static HTML/CSS/JS.
- **Paper MCP** (`paper` server) — use for reading and editing open Paper files, validating composition visually, and Paper-to-code workflows. Read `../virwave_v3/docs/setup/PAPER_MCP.md` first.
- **Google Stitch MCP** (`stitch` server) — generate full page mockups and components as HTML/CSS from text prompts. Use `get_screen_code` to get clean HTML/CSS that can be adapted directly into the static site. Best tool for this stack.
- **Nano Banana** (`nanobanana` server) — Gemini image generation. Use for hero images, feature illustrations, app screenshots for marketing pages. Requires `GEMINI_API_KEY` env var.
- **21st.dev MCP** (`magic` server) — UI component inspiration library and SVG icon search. Use for visual reference and interaction inspiration. Read `../virwave_v3/docs/setup/21ST_DEV_MCP.md` for adaptation rules. Do not import npm packages — adapt patterns to vanilla JS/CSS.
- **ui-ux-pro-max skill** — invoke with `/ui-ux-pro-max` before any page or component work. Stack: HTML/CSS/JS. Style: Liquid Glass, wellness minimalism, dark-first.

**Workflow for new pages/sections:**

1. Invoke `/ui-ux-pro-max` (stack: HTML5/CSS3/Vanilla JS)
2. If the work starts from a Figma or Make link, follow `../virwave_v3/docs/setup/FIGMA_MCP.md` and pull context from Figma first
3. If the work starts from an open Paper file or asks to modify a Paper canvas, follow `../virwave_v3/docs/setup/PAPER_MCP.md` and use Paper as the design source of truth
4. Stitch → `get_screen_code` → adapt HTML/CSS directly into the page when exploring directions or filling gaps
5. NanaBanana for any custom imagery needed

**Hard constraint:** No npm, no build step, no framework. Pure HTML/CSS/JS only.
