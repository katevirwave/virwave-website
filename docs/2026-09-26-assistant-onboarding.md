# Account launch cards and assistant setup guide

## Scope

A screenshot-led App Store card replaces the flat button on the signed-in page. It uses the existing website asset `assets/img/app-screens/2.png` unchanged: the breathing phone artwork from the site’s app-screen collection. Its crop is presentation CSS; no invented app UI or generated artwork. The existing App Store destination is unchanged.

Two assistant choices open `/assistants#chatgpt` and `/assistants#claude`. The setup email link is removed. The guide is a public, static, credential-free page with no JavaScript or auth-state access. It explains availability, the host-owned connection flow, a selectable server URL, a first-session prompt, and where to revoke access.

## Official onboarding examples, inspected 26 September 2026

These are established suppliers’ published patterns, not evidence of their conversion rates.

| Supplier | Entry and onward path | Pattern adopted |
| --- | --- | --- |
| [Stripe](https://docs.stripe.com/mcp) | Per-client sections; direct official ChatGPT plugin and Claude directory links; authenticate and grant permissions; custom server address as fallback. | Choose a host first, take users to that host, explain sign-in and consent. Only add a direct VirWave listing after its public availability is verified. |
| [Notion](https://www.notion.com/help/notion-mcp) | Gallery of compatible apps; direct setup through the AI app; separate manual connection instructions and permission guidance. | A small host chooser on the account screen, with a dedicated guide instead of email. |
| [Linear](https://linear.app/docs/mcp) | General remote endpoint plus client-specific guides; direct connectors/settings paths where supported; example prompts after setup. | Keep endpoint details in the guide, separate host instructions, finish with one useful breathing prompt. |

Claude steps checked against [the official custom connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp). ChatGPT apps/plugins destination was observed in the active production setup flow.

## Availability boundaries

The new private account-connected ChatGPT connection is now registered, but public installation is not yet available. The existing personal VirWave Breathe plugin URL is not verified public and is deliberately not advertised as an install link. The guide distinguishes this existing integration from the new connection, labels both new host paths as preview, and states that ChatGPT public installation is not available yet. Claude account testing is deferred at Sebastian’s request. No invented OAuth client IDs, callback URLs, or one-click installation links.

When the production host connection is proven, replace the relevant preview copy with the verified install destination and exact steps. Keep the ordinary account sign-in, consent, disconnect behavior and `/mcp` routing unchanged.

## Verification

26 September 2026: all 15 existing account/auth/routing tests passed, zero skips, including the local Chromium browser flow. Updated coverage checks the unchanged App Store destination, assistant anchors, actual artwork decoding, removal of setup email links, guide content and no auth script, 320/390/768/1440 widths, 200% text, and account consent/removal/timeout regressions. Account and guide screenshots were visually inspected. `git diff --check` passed. No auth runtime or deployment routing changed.

Local review screenshots: `/private/tmp/virwave-account-redesign.png` and `/private/tmp/virwave-assistant-guide.png`. The candidate is not deployed by this subtask.
