# Lessons

## Never invent visual assets from a type name

When the marketing site needs to render something the app already renders
(archetype shapes, phase glyphs, aura visuals, etc.), the source of truth is
the **rendering component in `virwave_v3`**, not the type name in a domain
file.

Example: `archetypes.ts` exports `shapeId: 'box' | 'pentagon' | ...` — that
gives names only. The actual SVG geometry lives in
`src/ui/ArchetypeShapeMark.tsx`. Always open the renderer and copy paths
verbatim (with matching viewBox and stroke width) rather than drawing new
shapes freehand.

Rule: if the website has to depict something the user will also see in the
app, grep `virwave_v3/src/` for the component that renders it and mirror it
exactly. If no such component exists, flag it to Kate before shipping an
invented version.

## Kate is an engineer — never frame her as the non-technical half

Kate writes production code on the live app. Any copy that splits the team
into "practitioner vs engineer", credits a single "sole engineer", or reads
her credentials as purely yoga/policy is wrong and has been corrected once.

Rule: when writing team or founder copy, lead with what she builds as well as
what she practises. Never use "not an engineer" as the flattering half of a
contrast, and never describe anyone else as the only engineer on the product.

## Don't credit the AI tooling as a company credential

"Built on Claude" and listing Claude alongside React Native / Supabase /
RevenueCat in the production stack were both cut. The tools used to write the
code are not a partner, a backer, or a differentiator, and naming one reads
as strange to investors.

Rule: keep the stack list to what actually runs in production. Never surface
the AI coding tooling in public-facing credibility copy.

## Partner credibility renders as logos, not typed names

The "Backed & built with" strip and the Receipts cards show the real marks —
white, transparent, optically size-matched — not the organisation's name in
mono type or a generic tick. Assets live in `assets/img/partners/`.

Rule: source marks from the organisation's own site (or katejulia.com, which
carries the ones Kate has rights to), key them to transparent, and give each
one its own `--logo-h` so a two-line lockup doesn't read half the size of a
compact wordmark. Where no logo exists (the Children's Digital Wellbeing
Framework has none), keep the styled text and say so — don't substitute the
funder's logo or draw one.

## One logo band, one label; claims stay as cards

Every partner, employer, client and school mark lives in a single scrolling
band in the hero under one label, "In good company". Splitting it into labelled
rows (worked / clients / studied) was tried and rejected as too many titles.

The Credibility section holds the claims that have no logo: shipping proof,
CDWF Advisory Panel, RYT-200, trauma-informed defaults, evidence base.

Rule: logos go in the band, never repeated as card icons. Text claims go in the
Credibility cards, never duplicated in the band. Do not reintroduce per-row
labels in the band.

## Prior-employer client logos must be labelled as prior-role work

Amazon, eBay, Meta, Stripe and Google were Kate's clients during her Deloitte
and KPMG years — not VirWave's customers, partners, or backers. Their
trademark policies specifically prohibit use that implies a relationship.

Rule: they sit in the shared "In good company" band, which claims association
and nothing more. Never move that band under a heading like "Backed & built
with", "Trusted by", or "Our clients". The same goes for UBS, which is
Sebastian's former employer.
