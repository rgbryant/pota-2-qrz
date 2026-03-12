# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Chrome Extension (Manifest V3) that adds a floating "Log QSO" panel to [pota.app](https://pota.app). It fetches spots from the POTA public API and lets the user log contacts directly to their QRZ.com logbook via the QRZ Logbook REST API.

## Build

```sh
npm install       # first time only
npm run build     # outputs to dist/
npm run watch     # rebuilds on file changes
```

`build.js` uses esbuild to minify `content.js`, `background.js`, and `popup.js`, then copies `manifest.json`, `popup.html`, `content.css`, and `icons/` verbatim to `dist/`. No bundling — files have no imports.

**To load in Chrome for development:** go to `chrome://extensions/`, enable Developer Mode, click "Load unpacked", and select the `dist/` folder. After running `npm run build` again, click the refresh icon on the extension card.

## Architecture

The extension follows the standard MV3 pattern with three execution contexts that communicate via Chrome message passing:

**`background.js` (service worker)** — Handles all outbound fetches to `https://logbook.qrz.com/api`. This is necessary because content scripts are subject to CORS restrictions; the service worker is not. Listens for `QRZ_LOG` (INSERT) and `QRZ_VERIFY` (STATUS) messages and responds with parsed URL-encoded key=value results from the QRZ API.

**`content.js` (injected into pota.app)** — Renders a self-contained floating panel (FAB button + slide-out panel) built entirely from `document.createElement` calls. Does not touch pota.app's Vue DOM at all — instead fetches spots directly from `https://api.pota.app/spot/activator` every 60 seconds. Contains all UI logic: spot list rendering with filter, the QSO log modal with a live UTC clock, ADIF string construction, and toast notifications. QRZ API calls are proxied to the background service worker via `chrome.runtime.sendMessage`.

**`popup.html` / `popup.js`** — Settings UI (callsign + QRZ API key). Reads/writes `chrome.storage.sync`. Content script listens to `chrome.storage.onChanged` to pick up new values without requiring a page reload.

## Key Data Flow

1. Content script fetches POTA spots → renders spot cards with "Log QSO" buttons
2. User clicks "Log QSO" → modal opens pre-filled with spot data + live UTC time
3. User submits → content script builds ADIF string → sends `QRZ_LOG` message to background
4. Background POSTs ADIF to QRZ API → parses URL-encoded response → returns `{ logid }` to content script

## ADIF Construction

ADIF fields are built inline in `content.js:logToQRZ()` using the format `<TAG:length>value`. Fields submitted: `CALL`, `STATION_CALLSIGN`, `BAND`, `MODE`, `QSO_DATE`, `TIME_ON`, `FREQ`, `RST_SENT`, `RST_RCVD`, `COMMENT`, `QTH`, `STATE`, `GRIDSQUARE`.

## Code Rules

- No file may exceed 350 lines. If a change would push a file over this limit, split it first.

## DOM Note

The extension deliberately avoids injecting into pota.app's reactive Vue DOM. All UI is appended directly to `document.body` using prefixed IDs/classes (`pqrz-*`) to avoid collisions.
