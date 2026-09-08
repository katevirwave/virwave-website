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

Standalone landing pages (no interest form) use --url with a brand profile:

  python scripts/generate-qr.py \
    --event "AIKEI London" \
    --url "https://aikei.virwave.com/london" \
    --brand aikei

Brand profiles:

  virwave (default) — VirWave design system
    - Dark modules:  Navy   #0D2137
    - Light modules: Off-white #F8F8F6
    - Center logo:   assets/logo_virwave.avif, circular
    - Rounded "pill" style modules

  aikei — AIKEI design system (zero corner radius throughout)
    - Dark modules:  Ink    #171C1B
    - Light modules: Paper  #F4F5F3
    - Center logo:   aikei-app/public/media/aikei-logo.png, square
    - Square modules
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
from qrcode.image.styles.moduledrawers.pil import (
    RoundedModuleDrawer,
    SquareModuleDrawer,
)
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

AIKEI_INK = (23, 28, 27)    # #171C1B
AIKEI_PAPER = (244, 245, 243)  # #F4F5F3

AIKEI_LOGO_PATH = REPO_ROOT / "aikei-app" / "public" / "media" / "aikei-logo.png"

# Brand profiles. The QR has to look like the site it lands on: VirWave is
# rounded and navy, AIKEI is square-cornered and near-black by design (its
# stylesheet sets every radius to 0).
BRANDS = {
    "virwave": {
        "front": NAVY,
        "back": OFF_WHITE,
        "drawer": RoundedModuleDrawer,
        "logo": LOGO_PATH,
        "logo_shape": "circle",
    },
    "aikei": {
        "front": AIKEI_INK,
        "back": AIKEI_PAPER,
        "drawer": SquareModuleDrawer,
        "logo": AIKEI_LOGO_PATH,
        "logo_shape": "square",
    },
}
DEFAULT_BRAND = "virwave"

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


def trim_to_artwork(img: Image.Image, gap_rows: int = 8) -> Image.Image:
    """Crop to the mark itself, dropping margins and detached corner marks.

    Two things get in the way of centring a logo on a QR:

    * source marks often sit off-centre in an oversized transparent canvas;
    * some exported assets carry a generator watermark in a bottom corner,
      separated from the artwork by a band of empty rows. AIKEI's logo has a
      Gemini badge under it, which would otherwise ride along into the QR.

    So: crop to the alpha bounding box, then cut at the first run of
    ``gap_rows`` fully-transparent rows. If the asset is later cleaned up, the
    gap disappears and nothing is trimmed.
    """
    bbox = img.getbbox()
    if not bbox:
        return img
    img = img.crop(bbox)

    alpha = img.getchannel("A")
    blank = [alpha.crop((0, y, img.width, y + 1)).getbbox() is None
             for y in range(img.height)]

    run = 0
    for y, empty in enumerate(blank):
        run = run + 1 if empty else 0
        if run >= gap_rows:
            img = img.crop((0, 0, img.width, y - run + 1))
            break

    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def get_logo_image(
    target_size: int,
    *,
    logo_path: Path = LOGO_PATH,
    backdrop: tuple[int, int, int] = OFF_WHITE,
    shape: str = "circle",
) -> Image.Image | None:
    """Load a logo, fit it to the QR center, and set it on a clear backdrop.

    The logo occupies ~18 % of the QR width so it stays within the
    error-correction budget (QR level H can tolerate ~30 % obscured).

    ``shape`` picks the backdrop: "circle" for VirWave, "square" for AIKEI,
    whose design system sets every corner radius to zero.
    """
    if not logo_path.exists():
        return None

    logo_dim = int(target_size * 0.18)
    if logo_dim < 20:
        return None

    logo = Image.open(logo_path).convert("RGBA")

    logo = trim_to_artwork(logo)

    # Fit inside a square box without distorting the aspect ratio.
    logo.thumbnail((logo_dim, logo_dim), Image.LANCZOS)

    padding = max(4, logo_dim // 12)

    if shape == "circle":
        # Circular mask on the mark, circular backdrop behind it.
        logo = logo.resize((logo_dim, logo_dim), Image.LANCZOS)
        mask = Image.new("L", (logo_dim, logo_dim), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, logo_dim - 1, logo_dim - 1), fill=255)
        logo.putalpha(mask)
        dim = logo_dim + padding * 2
        canvas = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
        ImageDraw.Draw(canvas).ellipse((0, 0, dim - 1, dim - 1), fill=(*backdrop, 255))
    else:
        # Rectangular backdrop hugging the mark on both axes: a square patch
        # around a wide mark would blank out modules for nothing.
        cw = logo.width + padding * 2
        ch = logo.height + padding * 2
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        ImageDraw.Draw(canvas).rectangle((0, 0, cw - 1, ch - 1), fill=(*backdrop, 255))

    lx = (canvas.width - logo.width) // 2
    ly = (canvas.height - logo.height) // 2
    canvas.paste(logo, (lx, ly), logo)
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
    url: str | None = None,
    brand: str = DEFAULT_BRAND,
) -> Path:
    """Generate a branded QR code and save it. Returns the output path.

    Two modes:

    * default — build a tracked ``virwave.com/interest/`` URL from the event,
      interest, source and campaign.
    * ``url`` given — encode that URL verbatim. Used for standalone landing
      pages such as ``aikei.virwave.com/london``, where the path *is* the
      attribution and query params would only make the code denser.
    """

    profile = BRANDS[brand]
    direct_url = bool(url)

    event_code = slugify(event)
    if not event_code:
        print("Error: event name produced empty slug.", file=sys.stderr)
        sys.exit(1)

    campaign_slug = slugify(campaign) if campaign else None

    if url:
        # Direct-URL mode: interest/source only annotate the manifest record.
        if not source:
            source = f"{DEFAULT_SOURCE_PREFIX}_{event_code}"
    else:
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
        module_drawer=profile["drawer"](),
        color_mask=SolidFillColorMask(
            back_color=profile["back"],
            front_color=profile["front"],
        ),
    ).convert("RGBA")

    # Resize to target dimensions
    img = img.resize((size, size), Image.LANCZOS)

    # Overlay logo in center
    logo = get_logo_image(
        size,
        logo_path=profile["logo"],
        backdrop=profile["back"],
        shape=profile["logo_shape"],
    )
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
        "brand": brand,
        "direct_url": direct_url,
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
    print(f"  Brand:      {brand}")
    if not direct_url:
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
  %(prog)s --event "AIKEI London" --url https://aikei.virwave.com/london --brand aikei
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
        "--url",
        help="Encode this URL verbatim instead of building an interest-form URL. "
             "Use for standalone landing pages (e.g. https://aikei.virwave.com/london).",
    )
    parser.add_argument(
        "--brand",
        choices=sorted(BRANDS),
        default=DEFAULT_BRAND,
        help=f"Brand profile for colours, module shape and centre logo. "
             f"Default: {DEFAULT_BRAND}.",
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
        url=args.url,
        brand=args.brand,
    )


if __name__ == "__main__":
    main()
