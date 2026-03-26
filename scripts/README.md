# VirWave Website — Scripts

Internal tooling for the VirWave website. These scripts are meant to be
invoked by AI agents or developers from the repository root.

## Prerequisites

```bash
# From the repo root, activate the Python venv:
source .venv/bin/activate

# Or use the venv Python directly:
.venv/bin/python scripts/<script>.py
```

Required packages (already installed in `.venv`): `qrcode[pil]`, `Pillow`.

---

## generate-qr.py — Branded QR Code Generator

Generates print-ready, branded QR codes that link to the VirWave interest
form with full tracking parameters baked in.

### What it does

1. Takes an **event name** (and optional interest, source, campaign)
2. Builds a tracked URL: `https://virwave.com/interest/?interest=...&source=...&event=...&campaign=...`
3. Generates an 800×800 QR code with VirWave branding:
   - Navy (#0D2137) modules on off-white (#F8F8F6) background
   - Rounded module shapes
   - VirWave logo centered (circular, with white ring)
   - Error correction level H (30% — safe with logo overlay)
4. Saves to `assets/qr/qr_<event-slug>[_<campaign>].png`
5. Updates `assets/qr/manifest.json` with the full record

### Usage

```bash
# Minimal — just name the event:
python scripts/generate-qr.py --event "Kate Breathwork Berlin 2026-04"

# Full options:
python scripts/generate-qr.py \
  --event "Wellness Expo Munich" \
  --interest partnership \
  --campaign wellness-expo-spring \
  --source qr_custom_source \
  --size 1200 \
  --format png

# List all previously generated QR codes:
python scripts/generate-qr.py --list
```

### Parameters

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--event` | **Yes** | — | Human-readable event name. Auto-slugified for `event_code`. |
| `--interest` | No | `early-access` | Interest type(s). Comma-separated for multi. Valid: `early-access`, `event`, `partnership`, `licensing`, `general`. |
| `--source` | No | `qr_<event-slug>` | Source tag for DB attribution. |
| `--campaign` | No | — | Optional campaign identifier. |
| `--size` | No | `800` | Image size in pixels (square). |
| `--format` | No | `png` | Output format: `png` or `webp`. |
| `--list` | No | — | List all generated QR codes instead of generating. |

### AI Agent Instructions

**To generate a QR code for a new event**, call:

```bash
.venv/bin/python scripts/generate-qr.py --event "<Event Name>"
```

The script handles everything automatically:
- Slugifies the event name → `event_code`
- Derives `source` as `qr_<event-code>` (unless overridden)
- Defaults to `interest=early-access` (the most common use case)
- Saves the image and updates the manifest

**To check what QR codes exist**, call:

```bash
.venv/bin/python scripts/generate-qr.py --list
```

Or read `assets/qr/manifest.json` directly — it contains every generated
QR code's filename, URL, event code, source, campaign, and timestamp.

**Common scenarios for an AI agent:**

| User says | Command |
|-----------|---------|
| "Create a QR code for Kate's breathwork event in Berlin" | `--event "Kate Breathwork Berlin 2026-04"` |
| "QR code for a partnership booth at Wellness Expo" | `--event "Wellness Expo" --interest partnership` |
| "QR for licensing inquiry at Health Tech Summit" | `--event "Health Tech Summit" --interest licensing` |
| "General signup QR for a flyer" | `--event "Flyer General" --interest general` |
| "What QR codes do we have?" | `--list` |

### How tracking flows to the database

The QR URL encodes tracking params that the interest form JS reads:

```
https://virwave.com/interest/?interest=early-access&source=qr_kate-event&event=kate-event&campaign=spring
```

When the user submits the form, these are stored in the `event_interest` table:

| URL param | DB column | Purpose |
|-----------|-----------|---------|
| `interest` | `interest_type` | What the person is interested in |
| `source` | `source` | Where they came from (e.g., `qr_kate-event`) |
| `event` | `event_code` | Which event (also used for duplicate detection with email) |
| `campaign` | `campaign_id` | Optional campaign grouping |

### Output structure

```
assets/qr/
├── manifest.json                                    # Index of all codes
├── qr_kate-breathwork-berlin-2026-04.png           # Event QR
├── qr_wellness-expo-munich_wellness-expo-spring.png # Event + campaign QR
└── ...
```

The `.png` and `.webp` files are gitignored (generated artifacts).
The `manifest.json` is tracked in git.

---

## capture-screenshot.sh + screenshot.mjs — Visual QA Screenshot Capture

Captures screenshots of the local website using a headless browser (Puppeteer) for
agent-driven visual QA. Automatically starts a dev server, installs Puppeteer
(to `.debug/`, not the project), captures at configurable viewports, and downscales
to max 800px wide JPEG for agent consumption.

See [VISUAL_QA.md](./VISUAL_QA.md) for full documentation, workflows, and options.

### Quick usage

```bash
# Capture homepage at all viewports (desktop, tablet, mobile):
bash scripts/capture-screenshot.sh --all-viewports

# Capture a specific page:
bash scripts/capture-screenshot.sh --url /interest/

# Mobile viewport:
bash scripts/capture-screenshot.sh --url /products/ --width 375 --height 812

# Clean up:
bash scripts/capture-screenshot.sh --cleanup
```

Screenshots save to `.debug/screenshots/*.review.jpg` (gitignored).

---

### Brand specification

| Element | Value |
|---------|-------|
| Dark modules | Navy `#0D2137` (13, 33, 55) |
| Background | Off-white `#F8F8F6` (248, 248, 246) |
| Module shape | Rounded (pill-style via `RoundedModuleDrawer`) |
| Center logo | `assets/logo_virwave.avif` — circular crop with white ring |
| Logo size | 18% of QR width (within H-level 30% error budget) |
| Default size | 800×800 px |
