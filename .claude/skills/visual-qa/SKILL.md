---
name: visual-qa
description: Capture and review website screenshots for visual QA — headless browser screenshots at desktop/tablet/mobile viewports, downscaled for agent consumption
---

# Visual QA for VirWave Website

Use this skill when implementing UI features, debugging visual issues, or verifying design changes on the website.

## Quick Reference

```bash
# All viewports (desktop + tablet + mobile):
bash scripts/capture-screenshot.sh --all-viewports

# Specific page:
bash scripts/capture-screenshot.sh --url /interest/

# Mobile only:
bash scripts/capture-screenshot.sh --url / --width 375 --height 812

# Full-page scroll capture:
bash scripts/capture-screenshot.sh --url / --full-page --all-viewports
```

Screenshots saved to `.debug/screenshots/` as max-800px-wide JPEGs.

## When to Use

1. **After UI changes** — capture before/after to verify
2. **Before claiming work is done** — visual proof
3. **Debugging layout issues** — capture at multiple viewports
4. **Design review** — capture all pages for comparison

## Important

- Screenshots are automatically downscaled to max 800px wide (prevents agent context overflow)
- First run auto-installs Puppeteer to `.debug/node_modules/` (not the project)
- Auto-starts Python HTTP server if not running
- Use `Read` tool to view the captured JPEG files
- Run `--cleanup` to remove old screenshots

## Full Documentation

See `scripts/VISUAL_QA.md` for complete options, troubleshooting, and workflows.
