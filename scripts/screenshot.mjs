#!/usr/bin/env node
/**
 * screenshot.mjs — Headless browser screenshot capture for visual QA.
 *
 * Uses Puppeteer to capture screenshots of the local dev server.
 * Puppeteer is installed to .debug/node_modules/ by the wrapper script.
 *
 * Usage:
 *   node scripts/screenshot.mjs [options]
 *
 * Options:
 *   --url <path>          URL path to capture (default: "/")
 *   --width <px>          Viewport width (default: 1440)
 *   --height <px>         Viewport height (default: 900)
 *   --output <filename>   Output filename (default: auto-generated)
 *   --port <port>         Dev server port (default: 8000)
 *   --all-viewports       Capture desktop, tablet, and mobile
 *   --settle <ms>         Wait time after load for animations (default: 2000)
 *   --full-page           Capture full scrollable page (default: false)
 *
 * Requires: puppeteer (auto-installed via the wrapper script)
 */

import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const SCREENSHOT_DIR = join(PROJECT_ROOT, '.debug', 'screenshots');
const MAX_REVIEW_WIDTH = 800;
const REVIEW_JPEG_QUALITY = '50';

// Named viewport presets
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, label: 'desktop' },
  tablet: { width: 768, height: 1024, label: 'tablet' },
  mobile: { width: 375, height: 812, label: 'mobile' },
};

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: '/' },
    width: { type: 'string', default: '1440' },
    height: { type: 'string', default: '900' },
    output: { type: 'string', default: '' },
    port: { type: 'string', default: '8000' },
    'all-viewports': { type: 'boolean', default: false },
    settle: { type: 'string', default: '2000' },
    'full-page': { type: 'boolean', default: false },
  },
  strict: false,
});

/**
 * Load puppeteer from .debug/node_modules/ or standard resolution.
 * Uses createRequire to resolve from the .debug/ install location.
 */
function loadPuppeteer() {
  // Try .debug/node_modules first (where the wrapper script installs it)
  const debugNodeModules = join(PROJECT_ROOT, '.debug', 'node_modules');
  const fakeOrigin = join(debugNodeModules, '.package.json');
  try {
    const req = createRequire(fakeOrigin);
    return req('puppeteer');
  } catch {
    // Fall back to standard resolution (global install, etc.)
    try {
      const req = createRequire(join(PROJECT_ROOT, 'package.json'));
      return req('puppeteer');
    } catch {
      return null;
    }
  }
}

/**
 * Downscale an image to max width using macOS sips.
 * Converts to JPEG for smaller file size (agent-friendly).
 */
function downscaleToReview(inputPath) {
  const reviewPath = inputPath.replace(/\.png$/, '.review.jpg');
  try {
    execSync(
      `sips -s format jpeg -s formatOptions ${REVIEW_JPEG_QUALITY} -Z ${MAX_REVIEW_WIDTH} "${inputPath}" --out "${reviewPath}"`,
      { stdio: 'pipe' }
    );
    // Remove the raw PNG -- agents should only use the review image
    try {
      execSync(`rm "${inputPath}"`, { stdio: 'pipe' });
    } catch {
      // Non-critical if delete fails
    }
    return reviewPath;
  } catch (err) {
    // sips not available (non-macOS) -- fall back to keeping the raw PNG
    console.error(`[warn] sips not available, keeping raw PNG: ${err.message}`);
    return inputPath;
  }
}

/**
 * Generate a filename from URL path + viewport label.
 */
function generateFilename(urlPath, viewportLabel) {
  const slug = urlPath === '/' ? 'home' : urlPath.replace(/^\//, '').replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${slug}-${viewportLabel}-${timestamp}.png`;
}

/**
 * Capture a single screenshot at the given viewport.
 */
async function captureScreenshot(browser, { urlPath, viewport, outputFilename, port, settleMs, fullPage }) {
  const page = await browser.newPage();
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });

  const url = `http://localhost:${port}${urlPath}`;
  console.error(`[capture] ${url} @ ${viewport.width}x${viewport.height}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
  } catch {
    // networkidle0 can be flaky -- try with domcontentloaded
    console.error(`[warn] networkidle0 timed out, retrying with domcontentloaded`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  }

  // Wait for animations/transitions to settle
  if (settleMs > 0) {
    await new Promise((r) => setTimeout(r, settleMs));
  }

  const rawPath = join(SCREENSHOT_DIR, outputFilename);
  await page.screenshot({ path: rawPath, fullPage });
  await page.close();

  // Verify the file exists and has content
  const fileStat = await stat(rawPath);
  if (fileStat.size < 10240) {
    console.error(`[warn] Screenshot is only ${fileStat.size} bytes -- may be blank or broken`);
  }

  // Downscale to review image (max 800px wide, JPEG)
  const reviewPath = downscaleToReview(rawPath);
  const reviewStat = await stat(reviewPath);

  return {
    path: reviewPath,
    sizeKB: Math.round(reviewStat.size / 1024),
    viewport: `${viewport.width}x${viewport.height}`,
  };
}

async function main() {
  const puppeteer = loadPuppeteer();
  if (!puppeteer) {
    console.error('[error] puppeteer not found. Use the wrapper: bash scripts/capture-screenshot.sh');
    process.exit(1);
  }

  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const urlPath = args.url.startsWith('/') ? args.url : `/${args.url}`;
  const port = parseInt(args.port, 10);
  const settleMs = parseInt(args.settle, 10);
  const fullPage = args['full-page'] || false;

  // Determine viewports to capture
  let viewports;
  if (args['all-viewports']) {
    viewports = Object.values(VIEWPORTS);
  } else {
    const w = parseInt(args.width, 10);
    const h = parseInt(args.height, 10);
    // Match to a named viewport if dimensions match
    const match = Object.values(VIEWPORTS).find((v) => v.width === w && v.height === h);
    viewports = [{ width: w, height: h, label: match?.label || `${w}x${h}` }];
  }

  // Launch headless browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const results = [];

  try {
    for (const vp of viewports) {
      const filename = args.output && viewports.length === 1
        ? args.output
        : generateFilename(urlPath, vp.label);

      const result = await captureScreenshot(browser, {
        urlPath,
        viewport: vp,
        outputFilename: filename,
        port,
        settleMs,
        fullPage,
      });
      results.push(result);
    }
  } finally {
    await browser.close();
  }

  // Output JSON to stdout for agent consumption.
  // All human-readable logs go to stderr so agents can parse stdout cleanly.
  const output = {
    success: true,
    screenshots: results,
    screenshotDir: SCREENSHOT_DIR,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
