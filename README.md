# Offline Page Extractor — Chrome Extension

This folder contains a standalone **Manifest V3** extension for exporting the current Chrome tab as a small offline project.

## Features

- Removes scripts, inline event handlers, SEO/Open Graph metadata, tracking pixels, `noscript`, `iframe`, comments, and non-title head elements.
- Keeps the currently rendered page markup and writes a minimal `<head>` with the original title and `style.css`.
- Reads same-origin accessible stylesheets, keeps selectors that match the current DOM, recursively preserves matching media/supports blocks, and retains keyframes used by active computed animations.
- Downloads page `<img>` elements and computed `background-image` assets into `images/`.
- Creates `index.html`, `style.css`, and `images/` inside a ZIP using the vendored JSZip library.

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this `chrome-extension` directory.
5. Open a normal website, click the extension icon, and click **Create offline ZIP**.

The extension intentionally does not attempt to bypass browser security boundaries. Browser-internal pages such as `chrome://` and some protected or cross-origin assets cannot be read. Cross-origin stylesheets that do not expose CSS rules are skipped by Chrome's security model.

## Files

- `manifest.json` — MV3 permissions, popup, service worker, and content script registration.
- `content.js` — page snapshot, HTML sanitation, selector matching, and asset discovery.
- `popup.html`, `popup.css`, `popup.js` — user interface and ZIP export flow.
- `background.js` — MV3 service worker bootstrap.
- `jszip.min.js` — JSZip library bundle used for local ZIP generation.
