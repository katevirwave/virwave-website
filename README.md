# VirWave Events App

Live engine for VirWave Events: participant sign-in, questions, matching, host dashboard.
Static marketing lives in [`virwave-website`](https://github.com/katevirwave/virwave-website)
under `/events/`. This repo is the dynamic half.

**Stack:** Next.js 14 (app router) · TypeScript · Supabase Auth + Postgres · Vercel.

## Prerequisites

- Node 20+
- Supabase project `xswebtvkueusdaeboizp` (shared with the main website)
- Migrations from `virwave-website/supabase/migrations/*.sql` already applied
- Vercel account

## Local development

```bash
npm install
cp .env.local.example .env.local   # publishable key is public-by-design
npm run dev
```

Open http://localhost:3000 — the host sign-in is at `/host`, a participant
flow is at `/events/<code>/join` (you'll need an event with matching `code`
in the `events` table).

## Environment variables

| Name | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key |

The publishable key is safe to commit or expose to the client — RLS enforces
access. Never add the *service role* key here; it belongs in Edge Functions only.

## Deploying to Vercel

1. Push this repo to GitHub (see below).
2. In Vercel: **New Project → Import** → pick this repo.
3. Add the two env vars above to **Production**, **Preview**, and **Development**.
4. Deploy. Default domain will be `virwave-events-app.vercel.app`; add a custom
   subdomain like `events.virwave.com` when ready.
5. In Supabase → Authentication → URL Configuration:
   - **Site URL:** your Vercel production URL
   - **Redirect URLs:** add the Vercel URL and `http://localhost:3000`

## First-time push to GitHub

```bash
cd /home/user/virwave-events-app
git init
git add .
git commit -m "chore: initial scaffold"

# Create the repo on github.com/new first, then:
git remote add origin https://github.com/katevirwave/virwave-events-app.git
git branch -M main
git push -u origin main
```

## What's built

- `/` — landing placeholder
- `/events/[code]/join` — participant: email OTP → first name + portrait opt-in → `join_event()` RPC
- `/host` — host sign-in (OTP, invite-only)
- `/host/[code]` — host dashboard with `host_room_summary` realms panel

## What's not built yet

- Questions flow (DB needs `event_questions` seeded first)
- Host reveal actions (push pair rankings, push table assignments)
- Matching Edge Function
- Pairs-mode realtime (v2)

## Security notes

- RLS policies are the security boundary — see `virwave-website/supabase/migrations/`.
- Never use the service-role key in this repo. Matching belongs in a Supabase
  Edge Function so the service-role key never leaves Supabase.
- The publishable key in `.env.local.example` is intentional: it's the public
  anon-equivalent key and is RLS-gated.
