# Lovable prompt — VirWave book gateway (animation pass)

Paste everything below the line into Lovable.

---

## Context — who this is for

You are enhancing the hero of **virwave.com**, the marketing site for VirWave OAM UK LTD.

VirWave is one company with two products, and the homepage has to let a visitor choose between them:

- **VirWave** — an AI-native relational wellness app, live on iOS and Android. Twelve breathing patterns, a four-layer emotional portrait, seventy-eight relational pairings. Tagline: *"Regulate Yourself. Rise for Others."* / *"Breathe first. Then move."* Brand is dark-first navy, calm luxury, neurodivergent-affirming, trauma-informed. Nothing shocks, pressures or shames.
- **AIKEI** — a release-testing product for AI that talks to children. Child-specific, multi-turn evaluations, transcript evidence, a defensible ship/fix/stop decision. Its brand is the opposite of VirWave's: light "paper", ink-on-cream, editorial, austere. Tagline: *"Evidence. Judgement. Release."*

The homepage hero is currently a **closed hardback book that opens into a two-page spread**. The left leaf is Volume One (the VirWave world, a dark "night" page). The right leaf is Volume Two (AIKEI, a cream paper page). The reader picks a page to enter. It is already built and working — your job is to make the *motion* worthy of it, not to redesign it.

## Hard constraints (this is the important part)

The site is **zero-build static HTML/CSS/JS on GitHub Pages/Vercel**. No npm, no bundler, no framework. Whatever you build gets hand-ported back into a single `styles.css` and one small vanilla JS file. So:

1. **No animation libraries.** No framer-motion, GSAP, three.js, Lottie, anime.js, Rive. CSS transitions/animations plus at most ~60 lines of plain JS.
2. **No web fonts.** Display type is `Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif`. Body is the system sans stack. Labels are the system mono stack. Do not add Google Fonts.
3. **No Tailwind-only tricks** that don't survive extraction — put the book's styling in a plain CSS block with custom properties, not scattered utility classes.
4. Deliver **one self-contained component plus one CSS block**, and keep every class name prefixed `book-gate`, `book-stage`, `book`, `book__*`.
5. Must work with `prefers-reduced-motion: reduce` (book renders already open, no turn, no loops, video paused on its poster frame) and must degrade to the open spread with JS disabled.

## The current build — reproduce this geometry exactly

The trick that makes it a real book: the turning leaf carries the **cover on its front face** and the **VirWave page on its back face**. Turning it reveals a genuine spread instead of faking one.

```
.book-stage   perspective: 2200px; perspective-origin: 50% 44%;
              --page-h: min(600px, 56vh, calc(40vw * 1.34));
              --page-w: calc(var(--page-h) / 1.34);

.book         width: calc(var(--page-w) * 2); height: var(--page-h);
              transform-style: preserve-3d;
              closed → translateX(calc(var(--page-w) / -2)) rotateX(5deg)
              open   → translateX(0) rotateX(5deg)
              transition: transform 1100ms cubic-bezier(0.33, 1, 0.68, 1)

.book__leaf--base   (AIKEI page)  position:absolute; right:0; width:var(--page-w);
                                  transform: translateZ(-1px)
.book__leaf--flip   (cover + VirWave page)
                                  position:absolute; right:0; width:var(--page-w);
                                  transform-origin: left center;
                                  closed → translateZ(1px) rotateY(0deg)
                                  open   → translateZ(1px) rotateY(-180deg)
  ├─ .book__face--cover     backface-visibility:hidden           (the hardback cover)
  └─ .book__face--virwave   transform:rotateY(180deg); backface-visibility:hidden
```

Because two mirrorings cancel, the VirWave face's local left edge lands on the screen's left — so on that face, `left:0` is the outer page edge and `right:0` is the gutter.

Also present: `.book__edge--right` / `.book__edge--left` (7px repeating-linear-gradient page-block edges just outside the leaves), `.book__gutter` (dark gradient down the spine, fades in when open), `.book__shadow` (radial drop under the book that widens from one page to two as it opens).

## Design tokens — use these exact values

```css
/* VirWave brand */
--navy: #0D2137;  --navy-deep: #091826;  --teal: #0A7EA4;  --mint: #8CEBAA;
--white: #F8F8F6; /* warm off-white, never pure #FFF */

/* Book — paper (AIKEI leaf) */
--book-paper: #EFE8D9;  --book-paper-2: #DED4BE;
--book-ink: #241F18;    --book-ink-mute: rgba(36,31,24,0.70);
--book-rule: rgba(36,31,24,0.18);  --book-rule-soft: rgba(36,31,24,0.10);
--book-teal: #0A5F76;   /* AA-contrast teal for ink-on-cream links */
--book-edge-line: rgba(36,31,24,0.30);

/* Book — night (VirWave leaf) */
--book-night: #0C2137;  --book-night-2: #071522;
--book-night-text: rgba(248,248,246,0.88);
--book-night-mute: rgba(248,248,246,0.58);
--book-night-rule: rgba(140,235,170,0.24);

/* Book — hardback cover */
--book-cover-1: #15455F;  --book-cover-2: #061320;
--book-emboss: rgba(255,255,255,0.14);  --book-emboss-2: rgba(255,255,255,0.05);
--book-gutter: rgba(4,12,20,0.45);      --book-drop: rgba(3,10,18,0.62);

/* Motion */
--ease-calm: cubic-bezier(0.33, 1, 0.68, 1);
--dur-snappy: 200ms;   /* hover, press, toggle */
--dur-gentle: 350ms;   /* reveals, transitions */
--dur-turn: 1100ms;    /* the page turn */
```

Type scales off the leaf, not the viewport — e.g. `font-size: clamp(1.15rem, calc(var(--page-w) * 0.088), 1.95rem)` for page titles. Keep that approach so the book stays proportional at every size.

## Content on the three faces

**Cover (closed):** VirWave logo mark, "VirWave" in mint serif, hairline rule, italic "Regulate Yourself. / Rise for Others.", debossed inset frame, cloth spine band down the left 11%, and "OPEN THE BOOK ›" pinned at the foot.

**Left leaf — Volume One:** eyebrow "VOLUME ONE" (mint mono caps) · title "The world of VirWave" · "Breathe first. Then move. Twelve breathing patterns, a four-layer emotional portrait, and language for the people you love." · an engraved figure plate (concentric mint breath rings over a horizon line and a soft wave — inline SVG, currently static) · meta line "The app · The world · The companions" · CTA "Enter VirWave →" (scrolls into the rest of the homepage).

**Right leaf — Volume Two:** eyebrow "VOLUME TWO" · title "AIKEI" · "The release test for AI that talks to children. Multi-turn evaluations, transcript evidence, and a decision you can defend." · a **plate holding a looping video of the two AIKEI mascots waving** — black line art on white, composited with `mix-blend-mode: multiply` so the white drops out and the mascots print straight onto the cream paper · meta line "Evidence · Judgement · Release" · CTA "Enter AIKEI →" (navigates to /aikei).

The mascots are two chibi winged unicorns, a big one and a small one, hand-drawn ink outline, already used across AIKEI's own site. Assume `mascots-wave.mp4` (520×520, 5s loop, muted, playsinline) with `mascots-wave.jpg` as poster.

## What I want you to add

Make the turn feel like paper and vellum, not like a rotating rectangle. In priority order:

1. **Cast shadow from the turning leaf.** As the cover swings, it should throw a moving shadow across the AIKEI page beneath it — strongest at the start, sweeping right to left and dissolving as the leaf passes vertical. This one detail is what sells a page turn; do it with an overlay gradient element on the base leaf whose opacity and position are driven by the same timing.

2. **Non-rigid paper.** A real page bends as it turns. Split the turn into two chained phases, or add a slight scaleX/skew and a soft highlight gradient that travels across the leaf face, so the sheet appears to bow at ~45–135° and flatten at the ends.

3. **Cover lift before the swing.** The hardback should lift 6–10px off the page block and tilt a few degrees before it rotates — a small anticipation beat, then the long ease.

4. **Idle breathing on the closed book.** Very slight, very slow: scale 1 → 1.006 over ~8s with the calm ease, plus a matching drift on the drop shadow. This is a breathing app; the object should breathe. Keep it far below the threshold of distraction, and kill it entirely under reduced motion.

5. **The engraved breath figure should animate.** The concentric rings should expand and settle on a genuine breathing cadence (roughly 4s in, 2s hold, 6s out), stroke opacity easing with them. No linear easing on the loop.

6. **Real 3D corner curl on hover.** Right now hovering a page fades in a flat gradient triangle. Make the outer corner actually lift off the page in 3D with a shadow underneath, and settle back on the snappy 200ms.

7. **Entry transitions.** "Enter AIKEI" should turn the right leaf out of the way as it navigates. "Enter VirWave" should feel like falling into the page — the spread scales up slightly and dissolves as the scroll begins. Both under 450ms, both skipped under reduced motion, and neither may trap the user if navigation stalls.

8. **Mascot plate.** Idle at rest; when the AIKEI page is hovered or focused, the wave restarts. Never autoplay-loop aggressively — it sits on a calm page.

9. **Focus parity.** Every hover behaviour must have a `:focus-visible` equivalent. The two pages are links; the cover is a `<button>` with `aria-expanded`. When closed, the page links must be out of the tab order.

## Sensory-safety rules that override everything above

No hard cuts, no linear easing on loops, no flashing, no parallax that fights the scroll, nothing that moves faster than the snappy 200ms except the deliberate 1100ms turn. If a flourish is impressive but busy, drop it. Calm beats spectacle every time — this is a product for people who might be dysregulated when they land on the page.

## Deliverable

A single page containing the book gateway at full viewport height, responsive from 375px to 1920px, with the spread collapsing to two stacked cards below 860px (cover shown alone until opened, then the two pages stack with VirWave first). Give me the CSS as one readable block with the custom properties at the top, and the JS as one small IIFE. Comment anything non-obvious about the 3D math.
