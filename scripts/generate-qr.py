#!/usr/bin/env python3
"""
VirWave — Branded QR Code Generator
====================================

Generates branded QR codes for events, campaigns, and interest forms.
Each QR code links to the VirWave interest page with proper tracking
parameters so the DB records exactly where each signup came from.

Usage (AI agent or CLI):

  # Minimal — just an event name:
  python scripts/generate-qr.py --event "Kate Breathwork Berlin 2026-04"

  # Full options:
  python scripts/generate-qr.py \
    --event "Kate Breathwork Berlin 2026-04" \
    --interest early-access \
    --campaign spring-wellness \
    --source qr_stage_slide \
    --size 800 \
    --format png

  # List previously generated QR codes:
  python scripts/generate-qr.py --list

Output:
  assets/qr/<event-code>[_<campaign>].png   — the QR image
  assets/qr/manifest.json                   — index of all generated codes

The manifest.json keeps a record of every QR code generated, making it
easy to look up which URL a given QR image encodes.

Brand spec (from VirWave design system):
  - Dark modules:  Navy   #0D2137
  - Light modules: Off-white #F8F8F6
  - Border/quiet zone:      Off-white
  - Center logo overlay (logo_virwave.avif → auto-converted)
  - Rounded "pill" style modules via the built-in style options
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask
from PIL import Image, ImageDraw

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
QR_DIR = REPO_ROOT / "assets" / "qr"
MANIFEST_PATH = QR_DIR / "manifest.json"
LOGO_PATH = REPO_ROOT / "assets" / "logo_virwave.avif"

BASE_URL = "https://virwave.com/interest/"

# Brand palette
NAVY = (13, 33, 55)        # #0D2137
TEAL = (10, 126, 164)      # #0A7EA4
OFF_WHITE = (248, 248, 246) # #F8F8F6
MINT = (140, 235, 170)      # #8CEBAA

DEFAULT_SIZE = 800  # px
DEFAULT_INTEREST = "early-access"
DEFAULT_SOURCE_PREFIX = "qr"

# Allowed interest values (must match interest form checkboxes)
VALID_INTERESTS = {"early-access", "event", "partnership", "licensing", "general"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    """Convert a human-readable string to a URL/file-safe slug."""
    slug = text.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")[:80]
    return slug


def build_url(*, interest: str, event_code: str, source: str, campaign: str | None) -> str:
    """Build the full interest-form URL with tracking params."""
    params: dict[str, str] = {
        "interest": interest,
        "source": source,
        "event": event_code,
    }
    if campaign:
        params["campaign"] = campaign
    return BASE_URL + "?" + urlencode(params)


def load_manifest() -> list[dict]:
    """Load the existing manifest, or return empty list."""
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, "r") as f:
            return json.load(f)
    return []


def save_manifest(entries: list[dict]) -> None:
    """Write manifest back to disk."""
    QR_DIR.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_PATH, "w") as f:
        json.dump(entries, f, indent=2)
    print(f"  Manifest updated → {MANIFEST_PATH.relative_to(REPO_ROOT)}")


def get_logo_image(target_size: int) -> Image.Image | None:
    """Load logo, resize it for the QR center, and make it circular.

    The logo occupies ~18 % of the QR width so it stays within the
    error-correction budget (QR level H can tolerate ~30 % obscured).
    """
    if not LOGO_PATH.exists():
        return None

    logo_dim = int(target_size * 0.18)
    if logo_dim < 20:
        return None

    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo = logo.resize((logo_dim, logo_dim), Image.LANCZOS)

    # Create circular mask
    mask = Image.new("L", (logo_dim, logo_dim), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, logo_dim - 1, logo_dim - 1), fill=255)
    logo.putalpha(mask)

    # Add a small white ring around the logo so modules don't crowd it
    padding = max(4, logo_dim // 12)
    padded_dim = logo_dim + padding * 2
    canvas = Image.new("RGBA", (padded_dim, padded_dim), (0, 0, 0, 0))

    # Draw white circle behind
    ring_draw = ImageDraw.Draw(canvas)
    ring_draw.ellipse(
        (0, 0, padded_dim - 1, padded_dim - 1),
        fill=(*OFF_WHITE, 255),
    )
    canvas.paste(logo, (padding, padding), logo)
    return canvas


# ---------------------------------------------------------------------------
# QR generation
# ---------------------------------------------------------------------------

def generate_qr(
    *,
    event: str,
    interest: str = DEFAULT_INTEREST,
    source: str | None = None,
    campaign: str | None = None,
    size: int = DEFAULT_SIZE,
    fmt: str = "png",
) -> Path:
    """Generate a branded QR code and save it. Returns the output path."""

    event_code = slugify(event)
    if not event_code:
        print("Error: event name produced empty slug.", file=sys.stderr)
        sys.exit(1)

    # Validate interest
    interests = [i.strip() for i in interest.split(",")]
    for i in interests:
        if i not in VALID_INTERESTS:
            print(
                f"Warning: '{i}' is not a recognised interest. "
                f"Valid values: {', '.join(sorted(VALID_INTERESTS))}",
                file=sys.stderr,
            )

    # Derive source from event code if not provided
    if not source:
        source = f"{DEFAULT_SOURCE_PREFIX}_{event_code}"

    campaign_slug = slugify(campaign) if campaign else None
    url = build_url(
        interest=interest,
        event_code=event_code,
        source=source,
        campaign=campaign_slug,
    )

    # File name
    parts = ["qr", event_code]
    if campaign_slug:
        parts.append(campaign_slug)
    filename = "_".join(parts) + f".{fmt}"
    output_path = QR_DIR / filename

    # Generate QR
    qr = qrcode.QRCode(
        version=None,  # auto-size
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # 30 % tolerance for logo
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
        color_mask=SolidFillColorMask(
            back_color=OFF_WHITE,
            front_color=NAVY,
        ),
    ).convert("RGBA")

    # Resize to target dimensions
    img = img.resize((size, size), Image.LANCZOS)

    # Overlay logo in center
    logo = get_logo_image(size)
    if logo:
        lx = (size - logo.width) // 2
        ly = (size - logo.height) // 2
        img.paste(logo, (lx, ly), logo)

    # Save
    QR_DIR.mkdir(parents=True, exist_ok=True)
    final = img.convert("RGB") if fmt == "png" else img
    final.save(output_path, fmt.upper())

    # Update manifest
    manifest = load_manifest()

    # Remove existing entry for same filename (re-generation)
    manifest = [e for e in manifest if e.get("filename") != filename]

    manifest.append({
        "filename": filename,
        "event": event,
        "event_code": event_code,
        "interest": interest,
        "source": source,
        "campaign": campaign_slug,
        "url": url,
        "size_px": size,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })
    save_manifest(manifest)

    # Summary
    rel_path = output_path.relative_to(REPO_ROOT)
    print()
    print("  ✔  QR code generated")
    print(f"  Image:      {rel_path}")
    print(f"  URL:        {url}")
    print(f"  Event code: {event_code}")
    print(f"  Source:     {source}")
    print(f"  Interest:   {interest}")
    if campaign_slug:
        print(f"  Campaign:   {campaign_slug}")
    print(f"  Size:       {size}×{size} px")
    print()

    return output_path


# ---------------------------------------------------------------------------
# List existing QR codes
# ---------------------------------------------------------------------------

def list_qr_codes() -> None:
    """Print a table of all generated QR codes from the manifest."""
    manifest = load_manifest()
    if not manifest:
        print("No QR codes generated yet. Run with --event to create one.")
        return

    print(f"\n  {'File':<45} {'Event code':<30} {'Interest':<15} {'Source'}")
    print(f"  {'─' * 45} {'─' * 30} {'─' * 15} {'─' * 30}")
    for entry in manifest:
        print(
            f"  {entry.get('filename', '?'):<45} "
            f"{entry.get('event_code', '?'):<30} "
            f"{entry.get('interest', '?'):<15} "
            f"{entry.get('source', '?')}"
        )
    print(f"\n  Total: {len(manifest)} QR code(s)\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="VirWave branded QR code generator for events & campaigns.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --event "Kate Breathwork Berlin 2026-04"
  %(prog)s --event "Wellness Expo Munich" --interest partnership --campaign wellness-expo
  %(prog)s --list
        """,
    )
    parser.add_argument(
        "--event",
        help="Event name (human-readable). Auto-slugified for the event_code param.",
    )
    parser.add_argument(
        "--interest",
        default=DEFAULT_INTEREST,
        help=f"Interest type(s), comma-separated. Default: {DEFAULT_INTEREST}. "
             f"Valid: {', '.join(sorted(VALID_INTERESTS))}",
    )
    parser.add_argument(
        "--source",
        help="Source tag for attribution. Default: qr_<event-code>.",
    )
    parser.add_argument(
        "--campaign",
        help="Optional campaign identifier.",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=DEFAULT_SIZE,
        help=f"Image size in px (square). Default: {DEFAULT_SIZE}.",
    )
    parser.add_argument(
        "--format",
        choices=["png", "webp"],
        default="png",
        help="Output format. Default: png.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all previously generated QR codes.",
    )

    args = parser.parse_args()

    if args.list:
        list_qr_codes()
        return

    if not args.event:
        parser.error("--event is required (or use --list to see existing codes).")

    generate_qr(
        event=args.event,
        interest=args.interest,
        source=args.source,
        campaign=args.campaign,
        size=args.size,
        fmt=args.format,
    )


if __name__ == "__main__":
    main()
