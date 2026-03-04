# VirWave — Product Website

Static website for [VirWave](https://virwave.com), a breathing and emotional regulation companion.

## Running locally

No build step required. Serve the root directory with any static file server:

```bash
# Python
python3 -m http.server 8000

# Node (npx)
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000`.

## Structure

```
/
├── index.html              # Homepage
├── blog/
│   ├── index.html          # Blog listing
│   ├── post.html           # Single post renderer
│   ├── posts.json          # Post metadata
│   └── posts/              # Markdown post files
│       ├── 2026-03-01-what-is-virwave.md
│       └── 2026-03-05-breathing-for-nervous-system.md
├── products/
│   └── index.html          # Products grid
├── privacy/
│   └── index.html          # Privacy policy
├── terms/
│   └── index.html          # Terms of service
├── interest/
│   └── index.html          # Interest / sign-up form
├── assets/
│   ├── css/styles.css      # All styles
│   ├── js/
│   │   ├── main.js         # Nav, visibility system, utilities
│   │   ├── supabase.js     # Lightweight PostgREST client (no SDK)
│   │   ├── blog.js         # Blog listing, post rendering, preview
│   │   └── markdown.js     # Client-side markdown parser (no deps)
│   ├── qr/                 # Generated QR codes (images gitignored)
│   │   └── manifest.json   # Index of all generated QR codes
│   ├── favicon.png
│   └── logo_virwave.avif
├── scripts/
│   ├── generate-qr.py      # Branded QR code generator (see below)
│   └── README.md           # Script documentation for AI agents
├── _config.json            # Visibility config (hide pages/sections)
├── _supabase.json          # Supabase connection config (public anon key)
├── sitemap.xml
├── robots.txt
├── CNAME                   # Custom domain: virwave.com
├── LICENSE                 # Dual license: MIT (code) + All Rights Reserved (content)
└── .gitignore
```

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Homepage | `/` | Hero, features, how it works, credibility, blog preview, contact |
| Blog | `/blog/` | All posts with tag filtering |
| Post | `/blog/post.html?slug=...` | Single post from markdown |
| Products | `/products/` | Product grid (app, board game, plushy, stories, partnerships, licensing) |
| Privacy | `/privacy/` | Privacy policy |
| Terms | `/terms/` | Terms of service |
| Interest | `/interest/` | Sign-up / interest form (event + general inbound) |

## Hiding pages and sections

Edit `_config.json` to control visibility without changing HTML:

```json
{
  "hiddenSections": ["credibility", "blog-preview"],
  "hiddenNav": ["products"],
  "hiddenPages": ["/products"]
}
```

- **`hiddenSections`** — hides any element with `data-section="key"`. Keys are used throughout the HTML (e.g., `hero`, `what-it-is`, `who-its-for`, `how-it-works`, `credibility`, `blog-preview`, `contact`, `product-app`, etc.)
- **`hiddenNav`** — hides nav items with `data-nav="key"` (e.g., `blog`, `products`)
- **`hiddenPages`** — redirects visitors from those paths back to homepage

## Blog system

1. Add post metadata to `blog/posts.json`
2. Add the markdown file to `blog/posts/`
3. The blog listing and homepage preview update automatically

## Interest form

The form at `/interest/` is the primary inbound form for all CTAs across the site.

**Features:**
- Multi-select interest pills (early-access, event, partnership, licensing, general)
- Split consent: required (release updates) + optional (marketing) — aligned with the v3 app
- Real-time validation with visual states, character counters, rate limiting
- Submits to Supabase via PostgREST (configured in `_supabase.json`)
- Duplicate detection: unique constraint on `(email_normalized, event_code)`

**URL parameters** pre-select interests and enable source tracking:

| Param | Example | Effect |
|-------|---------|--------|
| `interest` | `?interest=partnership` | Pre-checks the matching pill(s). Supports comma-separated. Alias: `waitlist` → `early-access` |
| `source` | `?source=qr_event-name` | Stored in `source` column for attribution |
| `event` | `?event=kate-breathwork-berlin` | Stored in `event_code` column |
| `campaign` | `?campaign=spring-2026` | Stored in `campaign_id` column |

**CTA routing** across the site:
- "Join Waitlist" → `/interest/?interest=early-access`
- "Partnerships" → `/interest/?interest=partnership`
- "Licensing" → `/interest/?interest=licensing`
- "Get in Touch" → `/interest/?interest=general`

## QR code generator

Generate branded, print-ready QR codes for events and campaigns. See [`scripts/README.md`](scripts/README.md) for full documentation.

Quick start:

```bash
# Activate the Python venv first
source .venv/bin/activate

# Generate a QR code for an event
python scripts/generate-qr.py --event "Kate Breathwork Berlin 2026-04"

# With custom interest + campaign
python scripts/generate-qr.py --event "Wellness Expo" --interest partnership --campaign spring-expo

# List all generated codes
python scripts/generate-qr.py --list
```

Output goes to `assets/qr/` with a `manifest.json` index. QR images are gitignored; the manifest is tracked.

## GitHub Pages deployment

1. Go to repo Settings → Pages
2. Set source to "Deploy from a branch" → `main` / `/ (root)`
3. If deploying to `username.github.io/virwave-website/`, update `<meta name="base-path">` in all HTML files to `/virwave-website/`

## Tech

- Plain HTML/CSS/JS — no frameworks, no build step, no npm
- Client-side markdown rendering (built-in parser)
- Responsive with hamburger nav on mobile
- Semantic HTML with aria labels
- OpenGraph tags on all pages

## License

Dual license — see [LICENSE](LICENSE):
- **Code** (HTML, CSS, JS): MIT License
- **Content** (blog posts, editorial copy, images, logos): All Rights Reserved — VirWave OAM

---

*VirWave is built by VirWave OAM.*