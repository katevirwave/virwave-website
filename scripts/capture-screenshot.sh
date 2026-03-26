#!/usr/bin/env bash
#
# capture-screenshot.sh — Visual QA screenshot capture for the VirWave website.
#
# Starts a local dev server if needed, ensures puppeteer is available,
# then delegates to screenshot.mjs for headless browser capture.
#
# Usage:
#   bash scripts/capture-screenshot.sh [options]
#
# Options:
#   --url <path>          URL path to capture (default: "/")
#   --width <px>          Viewport width (default: 1440)
#   --height <px>         Viewport height (default: 900)
#   --output <filename>   Output filename (default: auto-generated)
#   --port <port>         Dev server port (default: 8000)
#   --all-viewports       Capture desktop (1440x900), tablet (768x1024), mobile (375x812)
#   --settle <ms>         Wait time after load for animations (default: 2000)
#   --full-page           Capture full scrollable page
#   --cleanup             Remove all screenshots from .debug/screenshots/
#
# Examples:
#   # Capture homepage at all viewports:
#   bash scripts/capture-screenshot.sh --all-viewports
#
#   # Capture a specific page at mobile size:
#   bash scripts/capture-screenshot.sh --url /interest/ --width 375 --height 812
#
#   # Capture with custom output name:
#   bash scripts/capture-screenshot.sh --url /products/ --output products-desktop.png
#
#   # Clean up old screenshots:
#   bash scripts/capture-screenshot.sh --cleanup

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCREENSHOT_DIR="$PROJECT_ROOT/.debug/screenshots"
DEFAULT_PORT=8000

# --- Handle --cleanup flag ---
if [[ "${1:-}" == "--cleanup" ]]; then
    if [[ -d "$SCREENSHOT_DIR" ]]; then
        count=$(find "$SCREENSHOT_DIR" -type f | wc -l | tr -d ' ')
        rm -rf "$SCREENSHOT_DIR"
        echo "[cleanup] Removed $count files from $SCREENSHOT_DIR"
    else
        echo "[cleanup] No screenshots directory found. Nothing to clean."
    fi
    exit 0
fi

# --- Ensure .debug/screenshots/ exists ---
mkdir -p "$SCREENSHOT_DIR"

# --- Parse port from args (needed for server check) ---
PORT=$DEFAULT_PORT
ARGS=("$@")
for i in "${!ARGS[@]}"; do
    if [[ "${ARGS[$i]}" == "--port" ]] && [[ -n "${ARGS[$((i+1))]:-}" ]]; then
        PORT="${ARGS[$((i+1))]}"
    fi
done

# --- Start local dev server if not already running ---
SERVER_PID=""
if ! curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" | grep -q "200\|301\|302\|304"; then
    echo "[server] Starting Python HTTP server on port $PORT..."
    cd "$PROJECT_ROOT"
    python3 -m http.server "$PORT" --bind 127.0.0.1 &>/dev/null &
    SERVER_PID=$!
    # Wait for server to be ready
    for i in $(seq 1 20); do
        if curl -s -o /dev/null "http://localhost:$PORT/" 2>/dev/null; then
            echo "[server] Ready on http://localhost:$PORT"
            break
        fi
        if [[ $i -eq 20 ]]; then
            echo "[error] Server failed to start on port $PORT"
            kill "$SERVER_PID" 2>/dev/null || true
            exit 1
        fi
        sleep 0.25
    done
else
    echo "[server] Already running on http://localhost:$PORT"
fi

# --- Cleanup function to stop server if we started it ---
cleanup() {
    if [[ -n "$SERVER_PID" ]]; then
        echo "[server] Stopping dev server (PID $SERVER_PID)"
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# --- Ensure puppeteer is available in .debug/ ---
PUPPETEER_CACHE="$PROJECT_ROOT/.debug/.puppeteer-cache"
DEBUG_MODULES="$PROJECT_ROOT/.debug/node_modules"
export PUPPETEER_CACHE_DIR="$PUPPETEER_CACHE"

if [[ ! -d "$DEBUG_MODULES/puppeteer" ]]; then
    echo "[deps] Installing puppeteer to .debug/ (one-time, not a project dependency)..."
    npm install --prefix "$PROJECT_ROOT/.debug" puppeteer 2>&1 | tail -1
    echo "[deps] Puppeteer installed."
fi

# --- Run the screenshot script ---
# screenshot.mjs uses createRequire to resolve puppeteer from .debug/node_modules/.
echo "[capture] Running screenshot capture..."
node "$SCRIPT_DIR/screenshot.mjs" "$@"
