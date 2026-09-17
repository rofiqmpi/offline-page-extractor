#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/rofiqmpi/offline-page-extractor.git"
EXTENSION_DIR="${OFFLINE_PAGE_EXTENSION_DIR:-$HOME/offline-page-extractor}"
PROFILE_DIR="${OFFLINE_PAGE_PROFILE_DIR:-$HOME/.offline-page-extractor-browser}"
TARGET_URL="${1:-https://bangladesh.gov.bd/}"

if [ -d "$EXTENSION_DIR/.git" ]; then
  git -C "$EXTENSION_DIR" pull --ff-only origin main
else
  git clone "$REPO_URL" "$EXTENSION_DIR"
fi

BROWSER=""
for candidate in google-chrome microsoft-edge chromium chromium-browser brave-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then BROWSER="$(command -v "$candidate")"; break; fi
done

if [ -z "$BROWSER" ]; then
  echo "No Chromium-family browser found. Install Chrome, Edge, Brave, or Chromium." >&2
  exit 1
fi

exec "$BROWSER" \
  --user-data-dir="$PROFILE_DIR" \
  --load-extension="$EXTENSION_DIR" \
  --new-window "$TARGET_URL"
