# Offline Page Extractor — Cross-Browser WebExtension

A Manifest V3 WebExtension that exports the currently open page as a static offline project. It supports a compact **Visual Screenshot ZIP** mode and a DOM/CSS-preserving **Clean HTML/CSS ZIP** mode.

## Features

- Removes scripts, inline event handlers, SEO/Open Graph metadata, tracking pixels, `noscript`, `iframe`, comments, and non-title head elements.
- Downloads only rendered `<img>` and computed `background-image` assets. Hidden, zero-size, zero-opacity, and duplicate assets are skipped.
- Prunes hidden body subtrees and browser-injected nodes.
- **Visual Screenshot ZIP** captures the current viewport as `screenshot.png` and creates a small static `index.html`/`style.css` with no JavaScript or interactions.
- **Clean HTML/CSS ZIP** preserves the visible DOM and matching CSS rules as far as browser security permits.

## Public repository

```text
https://github.com/rofiqmpi/p2z
```

## Browser support

| Browser family | Manifest file | Loading method |
|---|---|---|
| Google Chrome | `manifest.json` | `chrome://extensions` → Developer mode → Load unpacked |
| Microsoft Edge | `manifest.json` | `edge://extensions` → Developer mode → Load unpacked |
| Brave, Vivaldi, Opera, Chromium | `manifest.json` | Their extensions page → Developer mode → Load unpacked |
| Mozilla Firefox | `manifest.firefox.json` | `about:debugging` → This Firefox → Load Temporary Add-on |

Chrome, Edge, Brave, Vivaldi, Opera, and Chromium use the standard `manifest.json`. Firefox uses `manifest.firefox.json` because Firefox's MV3 background-script format differs from Chromium's service-worker format.

## Install from the public GitHub repository

### Chromium browsers

```bash
git clone https://github.com/rofiqmpi/p2z.git
cd p2z
```

Then open the browser's extensions page and load the repository directory containing `manifest.json`.

For Chrome:

```text
chrome://extensions
```

For Edge:

```text
edge://extensions
```

Enable **Developer mode**, click **Load unpacked**, and select the cloned folder.

### Firefox

Clone the repository, open `about:debugging`, select **This Firefox**, click **Load Temporary Add-on**, and select `manifest.firefox.json`. Firefox temporary add-ons remain installed until Firefox is closed or the add-on is removed.

## Run with commands

The included launcher clones or updates the public repository and starts an available Chromium browser with the extension loaded:

```bash
bash run-extension.sh https://bangladesh.gov.bd/
```

The launcher supports `google-chrome`, `chromium`, `chromium-browser`, and `microsoft-edge` when installed. Firefox must be loaded through `about:debugging` because temporary Firefox add-ons use a different loading workflow.

### Windows PowerShell

The public repository includes `run-extension.ps1`. It clones or updates the extension, opens an isolated Chrome/Edge/Brave profile, and loads the extension automatically:

**Short command:**

For a genuinely short command, run this one-time setup command in PowerShell:

```powershell
irm https://raw.githubusercontent.com/rofiqmpi/p2z/main/run-extension.ps1 -OutFile "$HOME\p2z.ps1"; New-Item (Split-Path $PROFILE) -ItemType Directory -Force | Out-Null; Add-Content $PROFILE 'function p2z { powershell -ExecutionPolicy Bypass -File "$HOME\p2z.ps1" }'; . $PROFILE
```

After that, the permanent command is only:

```powershell
p2z
```

This opens the browser on a blank tab. You can then open any website yourself and use the extension popup to export it. PowerShell aliases normally last for the current session; to keep `p2z` after reopening PowerShell, add the setup line to your PowerShell profile.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
irm https://raw.githubusercontent.com/rofiqmpi/p2z/main/run-extension.ps1 -OutFile "$env:TEMP\run-p2z.ps1"
powershell -ExecutionPolicy Bypass -File "$env:TEMP\run-p2z.ps1"
```

The browser opens on a blank tab. Open any website in that browser, wait for it to finish loading, close unwanted overlays, click the extension icon, and choose **Visual Screenshot ZIP** or **Clean HTML/CSS ZIP**. To start directly on a known site:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-extension.ps1 -TargetUrl "https://bangladesh.gov.bd/" -Mode Visual
```

The launcher deliberately does not download every page automatically. The export is started from the extension popup after you have opened and prepared the exact page you want, preventing accidental downloads while browsing.

## Use the extension

1. Open the target page and wait for it to finish loading.
2. Close any modal, cookie notice, dropdown, or overlay that should not appear in the export.
3. Click the extension icon.
4. Choose **Visual Screenshot ZIP** for a compact static visual snapshot, or **Clean HTML/CSS ZIP** for the DOM-preserving export.
5. Extract the ZIP and open `index.html` with VS Code Live Server or another local web server.

The extension cannot bypass browser security boundaries. Browser-internal pages, protected resources, inaccessible cross-origin stylesheets, and authenticated images may be skipped.

## Files

- `manifest.json` — Chromium MV3 manifest.
- `manifest.firefox.json` — Firefox MV3-compatible manifest variant.
- `content.js` — page snapshot, visible DOM pruning, selector matching, and asset discovery.
- `popup.html`, `popup.css`, `popup.js` — export UI and ZIP generation.
- `background.js` — extension background bootstrap.
- `jszip.min.js` — locally vendored ZIP library.
- `run-extension.sh` — command-line launcher for Chromium-family browsers.
