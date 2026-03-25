# Visual QA System for VirWave Website

Headless browser screenshot capture for agent-driven visual QA.
Works with both Claude Code and GitHub Copilot agents.

## Quick Start

```bash
# Capture homepage at all viewports (desktop, tablet, mobile):
bash scripts/capture-screenshot.sh --all-viewports

# Capture a specific page at desktop size:
bash scripts/capture-screenshot.sh --url /interest/

# Capture at mobile viewport:
bash scripts/capture-screenshot.sh --url /products/ --width 375 --height 812

# Clean up old screenshots:
bash scripts/capture-screenshot.sh --cleanup
```

## How It Works

1. The shell script starts a local Python HTTP server if one is not already running
2. It ensures Puppeteer is available (auto-installs to `.debug/` if needed, no project deps touched)
3. The Node.js script launches headless Chrome and captures the page
4. Screenshots are downscaled to max 800px wide using macOS `sips` (JPEG, ~50% quality)
5. Raw PNGs are deleted; only the review JPEG is kept in `.debug/screenshots/`

## Options

| Flag              | Default | Description                                       |
|-------------------|---------|---------------------------------------------------|
| `--url <path>`    | `/`     | URL path to capture                               |
| `--width <px>`    | `1440`  | Viewport width                                    |
| `--height <px>`   | `900`   | Viewport height                                   |
| `--output <name>` | auto    | Output filename (auto-generated if omitted)       |
| `--port <port>`   | `8000`  | Local dev server port                             |
| `--all-viewports` | false   | Capture desktop (1440x900), tablet (768x1024), mobile (375x812) |
| `--settle <ms>`   | `2000`  | Wait time after page load for animations to settle |
| `--full-page`     | false   | Capture the full scrollable page, not just viewport |
| `--cleanup`       | -       | Remove all screenshots from `.debug/screenshots/` |

## Viewport Presets

| Name    | Width | Height | Use case                          |
|---------|-------|--------|-----------------------------------|
| Desktop | 1440  | 900    | Standard laptop/desktop           |
| Tablet  | 768   | 1024   | iPad portrait                     |
| Mobile  | 375   | 812    | iPhone 13/14 portrait             |

## Agent Workflows

### Workflow A: Verify a UI Change

After editing HTML/CSS/JS:

```bash
# Clean up old screenshots first
bash scripts/capture-screenshot.sh --cleanup

# Capture the changed page
bash scripts/capture-screenshot.sh --url /interest/ --all-viewports
```

Then use `view_image` on the `.review.jpg` files in `.debug/screenshots/` to inspect.
Present findings to the user with a description of what is visible.

### Workflow B: Before/After Comparison

```bash
# 1. Capture the current state
bash scripts/capture-screenshot.sh --url / --output before.png

# 2. Make your changes to the code

# 3. Capture the new state
bash scripts/capture-screenshot.sh --url / --output after.png
```

Compare both `.review.jpg` files using `view_image`.

### Workflow C: Full-Page Audit

```bash
# Capture every major page at all viewports
for page in "/" "/interest/" "/products/" "/blog/" "/privacy/" "/terms/"; do
    bash scripts/capture-screenshot.sh --url "$page" --all-viewports
done
```

### Workflow D: Quick Single Check

```bash
# Just the homepage, default desktop viewport
bash scripts/capture-screenshot.sh
```

## Image Size Warning

All screenshots are automatically downscaled to max 800px width and converted to JPEG.
This is critical because:

- Large images can break agent context windows or cause slowdowns
- The raw viewport capture at 1440px would be too large for efficient agent review
- JPEG at 50% quality keeps file sizes under 200KB typically

If `sips` is not available (non-macOS), raw PNGs are kept. These will be larger.

## Storage Locations

| Purpose           | Path                           | Git status |
|--------------------|-------------------------------|------------|
| Review screenshots | `.debug/screenshots/*.review.jpg` | Gitignored |
| Puppeteer cache    | `.debug/.puppeteer-cache/`    | Gitignored |
| Puppeteer modules  | `.debug/node_modules/`        | Gitignored |

The entire `.debug/` directory is gitignored. Nothing in this system affects the
project's zero-dependency status.

## Output Format

The screenshot script outputs JSON for agent consumption:

```json
{
  "success": true,
  "screenshots": [
    {
      "path": "/path/to/.debug/screenshots/home-desktop-2026-03-25T10-30-00.review.jpg",
      "sizeKB": 142,
      "viewport": "1440x900"
    }
  ],
  "screenshotDir": "/path/to/.debug/screenshots"
}
```

Agents should parse this JSON to find the screenshot paths for `view_image`.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "puppeteer not found" | Run the shell wrapper, not the .mjs directly |
| Server won't start | Check if port 8000 is in use: `lsof -i :8000` |
| Blank/tiny screenshots | Page may still be loading; increase `--settle` |
| sips errors | Only affects macOS; on other platforms raw PNGs are kept |
| Puppeteer can't find Chrome | Delete `.debug/.puppeteer-cache/` and retry |

## Design Decisions

- **No permanent dependencies.** Puppeteer installs to `.debug/` via npm, not the project root.
- **macOS sips for downscaling.** Native tool, no extra deps, same approach as virwave_v3.
- **JPEG review images.** Smaller files, faster agent processing, sufficient quality for QA.
- **Auto-start dev server.** Agents don't need to manage server lifecycle separately.
- **JSON output.** Structured output for agent parsing, not human-friendly logs.
