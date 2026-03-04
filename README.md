# VirWave — Product Website

Static website for [VirWave](https://virwave.com), a breathing and wellness companion.

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
│   └── index.html          # Interest / sign-up form (QR-linkable)
├── assets/
│   ├── css/styles.css      # All styles
│   ├── js/
│   │   ├── main.js         # Nav, visibility system, utilities
│   │   ├── blog.js         # Blog listing, post rendering, preview
│   │   └── markdown.js     # Client-side markdown parser (no deps)
│   ├── favicon.png
│   └── logo_virwave.avif
├── _config.json            # Visibility config (hide pages/sections)
├── sitemap.xml
├── robots.txt
├── LICENSE
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

The form at `/interest/` is a generic inbound form suitable for:
- Event sign-ups (link with `?source=event-name`)
- General early-access interest
- Partnership inquiries

Currently stores to `localStorage` as a placeholder. Replace the submit handler with your backend (Supabase, Formspree, etc.).

The page includes a QR code placeholder section — replace with a real QR code pointing to `https://virwave.com/interest/`.

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

MIT — see [LICENSE](LICENSE).

---

*VirWave is built by VirWave OAM.*