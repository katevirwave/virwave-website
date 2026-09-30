# VirWave account connection candidate

Branch: `codex/mcp-account-connect`, based on upstream `96795a7`.
Companion app branch: `codex/mcp-online-trial`.
Deployed on 25 September 2026 after Sebastian's approval. Kate's `/breathe` is unchanged. The homepage now exposes Account in its header/footer and Get the app opens the existing App Store listing directly. Source changes remain in this isolated branch and must be integrated before the next routine main-branch deployment. See the companion production rollout record for the current deployment ID.

## Timeout recovery — 25 September follow-up

Live verification: commit `1efb515`, all 15 website tests passed with zero skips, independent specialist review found no blocker, and production browser verified the recovery screen and retry. Production HTML, both auth scripts, and CSS match tested bytes. Current production deployment is `dpl_FAmyHfcBQjbtujCZKBXMV9vky2UP` (`https://virwave-website-eupgiauy9-vir-wave.vercel.app`), promoted from the successfully verified GitHub preview `dpl_FQGnHurjSvNGMTTiQtFmC6CFcSaU`. The direct CLI deployment was blocked by commit-author permissions; the normal public-GitHub integration and promotion succeeded without changing identities or access controls. Rollback is the prior account deployment `dpl_2JZ1hqVEC2ABcLAY6yCmSg6fBqUo`.

Sebastian requested a dedicated timeout screen instead of the ordinary welcome/login form with a warning. The account page now hides the form, focuses a "Sign-in timed out" heading, explains what happened, and offers one "Try again" button to return to fresh sign-in. Assistant connections must restart in the originating app. Both Supabase `bad_oauth_state` and a locally expired valid PKCE attempt use this state; expired state is removed and never exchanged or reused. No provider, callback, scope, or shared Auth setting changes.

Google's exact original teal app icon is now verified, published, and visually checked on a fresh chooser. A fresh Google login returned successfully to `/account`. Apple real sign-in remains in user handoff. Website branch was pushed publicly with Sebastian's explicit authorization; no main merge.

## Small implementation

Latest follow-up: an expired Google provider state was observed returning to the site root. The exact `error_code=bad_oauth_state` fallback now redirects to `/account`, clears stale PKCE state and URL parameters, does not exchange a supplied code, and displays fixed retry instructions. The user's fresh Google sign-in completed successfully. All 15 website tests passed with the browser test enabled; an independent specialist found no blocker. Production deployment `dpl_2JZ1hqVEC2ABcLAY6yCmSg6fBqUo` was verified with a synthetic expiry return. No shared Auth configuration changed for this recovery.

- `/account` uses the existing static HTML/CSS/JavaScript stack. No framework, npm package, build step, analytics, or new hosting service.
- Supabase Auth owns email codes, account creation, Apple/Google login, native OAuth consent, refresh, and grant removal.
- Page account tokens stay in memory. Provider PKCE stores only a short-lived, one-use verifier and return state in this tab. Codes are removed from the return URL immediately.
- Record the app's privacy-v1 and 13+ declarations before allowing a connection. The companion database enforces them too. Marketing and research settings are not granted or overwritten.
- All existing MCP operations remain free; no entitlement is issued by signup.
- `/mcp` and its protected-resource metadata route forward to the separately authenticated `breathe-connected` Supabase function. No player page is added. No caching is enabled.
- The credential retains Supabase Auth account permissions. The consent text states that limitation; do not describe it as a breathing-only token.

## Tests

No website dependency installation is needed:

```sh
node --test tests/connect-auth.test.mjs tests/connect-provider.test.mjs tests/connect-routing.test.mjs
```

For the browser test, set `VIRWAVE_PLAYWRIGHT` to an existing Playwright module's absolute `index.mjs` path and `PLAYWRIGHT_BROWSERS_PATH` to its installed browser directory, then run `node --test tests/connect-browser.test.mjs`.

The companion app's `scripts/mcp-auth-validation/full-stack.mjs` and `connected-end-to-end.integration.test.ts` test this actual page with real local Supabase email/code issuance, consent, token exchange, player recording, account history, private Storage denial, and connection removal. The website worktree must sit beside the app candidate as `mcp-website-account` for that test. No real user credentials are used.

## Coordinated release checklist

1. Deploy the companion database migrations and `breathe-connected` only after explicit release approval. Keep the existing `breathe` endpoint and offline package intact.
2. Set the resource to `https://virwave.com/mcp` in both the private OAuth client registry and the function environment. Set the issuer to the project's native Auth issuer. Register exact supported host callback addresses and approve only their client IDs; keep dynamic registration disabled initially.
3. Publish this static candidate. Verify `/connect` headers, both `/mcp` routes, no-store responses, forwarded Authorization and POST bodies, and OAuth challenges through Vercel. Static configuration is not live routing evidence.
4. Enable native OAuth and the reviewed custom token hook. Use hosted Auth Site URL `https://virwave.com` and authorization path `/connect`. Preserve the app's explicit mobile redirect allowlist; do not blindly push the repository's entire Auth config. Keep the existing app sign-in/refresh working.
5. Verify production SMTP/Resend, email template and code expiry, Apple/Google browser return URLs, and ordinary app login. Public provider flags alone do not prove these settings.
6. Test protected MCP Apps Begin, pause/resume, save retry, replay and revocation in each supported ChatGPT/Claude application. Prior basic remote connectivity is accepted, but is not this protected-player check.

Current live evidence on 25 September: `/connect` returns 200 with security headers, native OAuth discovery returns 200, unauthenticated `/mcp` POST returns 401 with the resource metadata challenge. Both the advertised metadata route and standard `/.well-known/oauth-protected-resource/mcp` fallback return the canonical resource with no-store. The production MCP SDK test verifies forwarded Authorization and POST bodies. All 14 local website tests passed, with no skips, including browser/mobile/200% text, provider-error context and legacy privacy redirect tests.

Shared Auth now uses this site's `/connect` path. Actual Resend email delivery, signup and returning-user sign-in passed using a dedicated test alias and delivered codes. The test account was deleted and cleanup verified. Google reaches account selection/password entry; Apple reaches its VirWave sign-in prompt. Both still require user credentials to finish; social callback success is not claimed. ChatGPT creation failed before OAuth even with an explicitly approved temporary diagnostic client, which was then deleted. Actual ChatGPT/Claude protected playback remains untested. See the companion app's `docs/plans/2026-09-25-mcp-production-rollout.md` for exact settings, registered client, cleanup, recovery and test boundaries.

## Account presentation

Google branding follow-up: after Sebastian explicitly approved Production publishing, Google verified the existing VirWave name/logo with corrected `https://virwave.com/privacy` and `https://virwave.com/terms` links. The branding was published and a fresh `/account` → Google check showed **to continue to VirWave** and the logo. No new scopes, callback changes, or paid services were introduced. This supersedes earlier branding-blocked notes in this document; the check stopped at account selection.

25 September follow-up: the canonical page is `/account`. Normal sign-in shows a minimal account home (email, app download, assistant next steps, and connected assistants). Assistant-initiated sign-in skips the home and proceeds directly to the existing consent step. Disconnect has an explicit confirmation and calls only native grant revocation; it does not delete the account or history, or sign the user out of the native app. An unavailable grant list has a retry state without hiding account next steps.

Legacy `/connect` requests redirect to `/account` with their query string. An in-flight provider return containing `login_state` is instead internally served the same page at its original path; the stored callback origin/path/state is validated before the page canonicalizes to `/account`. Keep both callback URLs in hosted Auth's redirect allowlist. Route security headers cover both paths. Do not replace this compatibility rule with an unconditional redirect while old provider attempts can still return.

Verification: all 14 website tests pass including browser, mobile/200% text, legacy provider callback replay rejection, list retry, and grant-only confirmation. The full local MCP suite with account-to-player integration enabled passed 395 tests, with 13 other opt-in tests skipped; its synthetic stack was removed afterward. This is not ChatGPT acceptance evidence.

The page reuses the site's navy/mint design, exact app icon and official provider artwork (see `account-brand-assets.md`). It uses a compact card and explicit sign-in/signup modes, without removing the security/age/privacy consent steps. Account links open the same page used by assistant authorization. A verified provider cancellation preserves assistant context for email fallback; a regression test and fresh specialist review cover this change. The exact legacy `/pages/privacy-policy` path used by Google's consent screen redirects to the current `/privacy` page. Google console branding remains unchanged.

The website's existing `/assets/icon.png` is byte-for-byte identical to `virwave_v3/assets/icon.png`. The connected MCP advertises this VirWave app icon; no replacement artwork was generated.

Routing uses [Vercel's existing external rewrite support](https://vercel.com/docs/routing/rewrites). It does not replace authorization in Supabase or guarantee that the deployed route has been tested.

## 26 September — Account next steps candidate

The signed-in page now uses the existing breathing phone artwork in its App Store card and offers ChatGPT/Claude guide links. `/assistants` explains the connection flow, preview availability, server address, a first breathing prompt, and removal of access. The assistant setup email CTA is removed. The new private ChatGPT connection is registered, but no public installation link is advertised. Claude account testing remains deferred. Auth runtime, consent, routing, and deployment settings are unchanged.

All 15 website tests pass with zero skips, including the local Chromium account flow, artwork loading, guide links, 320–1440 widths, 200% text, and existing authentication/recovery checks. Research and scope: [assistant onboarding](2026-09-26-assistant-onboarding.md). These presentation changes are reviewed source awaiting production promotion; publication is not claimed here.

## 27 September — Consent redesign published

The reviewed consent redesign is live at **https://virwave.com**, promoted at **00:49 BST on 27 September 2026**. This supersedes the earlier candidate-only publication notes. Source: `a0ff4219f40a265434ce53e1e746c988f816b5e4` on `codex/mcp-account-connect`; no main merge.

The GitHub commit status tied that source to READY preview `dpl_GWvLTYedRT1BtvhHK1ti6W9WWcHb`. Authenticated preview verification byte-matched five files: `/account` HTML, `/assets/css/styles.css`, `/assets/js/connect.mjs`, `/assets/js/connect-auth.mjs`, and `/assets/icon.png`. Vercel promotion produced READY production deployment **`dpl_5rPAjhB4Gs3emiKZMC2DPjk5aif6`**. The same five production responses byte-matched source; `X-Frame-Options: DENY`, no-store caching, and CSP `frame-ancestors 'none'` were preserved. The previous production deployment, **`dpl_9B1ZPkUqfLT657eCLx1jALTEnd38`**, is the rollback reference. These deployment checks were performed by the parent release agent; this documentation update performs no further deployment.

The original logo now remains inside the consent card when its heading receives focus. Both exact registered ChatGPT and Claude clients get a clear heading and readable purpose/permission rows. Unknown clients and permissions retain truthful fallbacks. The independently reviewed account-access warning remains visible, and age/privacy declarations remain unchecked. Research/marketing preferences are not added or changed. [Design and test details](2026-09-27-consent-design.md) records the implementation-time checks.

All **15 website tests passed, zero skipped**, after the final copy correction. Independent authentication/copy review found no blockers; the parent visually checked synthetic mobile and desktop consent screens. No real Kate/Claude login or new grant was performed for this release. The temporary loopback fixture was stopped after review. This consent presentation release is not proof of a public assistant listing or Claude account acceptance.

### Consent provider icons (2026-09-27)

The consent header identifies the destination with an unchanged official provider icon beside the VirWave identity and a neutral link symbol. Provider icons use the same reviewed client-ID mapping as the heading; unknown clients receive no provider icon. These identify the requested connection, not a commercial partnership.

Asset provenance:
- `assets/img/partners/claude-icon.svg`: unchanged `ClaudeIcon-Rounded.svg` from the official [Anthropic press kit](https://www.anthropic.com/press-kit), downloaded 2026-09-27.
- `assets/img/partners/chatgpt-icon.webp`: unchanged image linked from [OpenAI’s official ChatGPT icon help page](https://help.openai.com/en/articles/7905742-what-does-the-official-chatgpt-ios-app-icon-look-like), downloaded 2026-09-27. ChatGPT and its logo belong to OpenAI; follow [OpenAI brand guidance](https://openai.com/brand/). Claude and its logo belong to Anthropic.

No external image requests, consent changes, or new authentication settings.
