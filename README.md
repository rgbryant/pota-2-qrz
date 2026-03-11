# POTA → QRZ Logger — Chrome Extension

A Chrome extension that enhances **pota.app** by adding a **"Log QSO"** button next to every Respot button. One click opens a pre-filled QSO form; confirm it to instantly log the contact to your **QRZ.com Logbook** via the QRZ Logbook REST API.

---

## Features

- 🔴 Injects a **"Log QSO"** button next to each Respot button on `pota.app`
- 📋 Pre-fills callsign, frequency, band, mode, park reference, and UTC date/time from the spot
- ✏️ Editable modal lets you review and adjust before submitting
- 🔗 Submits a proper **ADIF-formatted** QSO to the QRZ Logbook API
- ⚙️ Settings popup stores your callsign, API key, and RST defaults
- ♻️ Works dynamically as new spots load (SPA-aware via MutationObserver)

---

## Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle top-right)
4. Click **Load unpacked**
5. Select the `pota-qrz-extension` folder

---

## Configuration

1. Click the extension icon (📡) in Chrome's toolbar
2. Enter your **callsign** and **QRZ Logbook API Key**
3. Set your default RST values and preferred mode
4. Click **Save Settings**

### Getting your QRZ API Key

1. Log in to [qrz.com](https://www.qrz.com)
2. Go to **Logbook** → click your callsign → **Settings**
3. Find the **API Access Key** section
4. Copy the key (format: `XXXX-XXXX-XXXX-XXXX`)

> **Note:** The QRZ Logbook API requires an active **QRZ XML subscription**.

---

## How It Works

1. Navigate to `https://pota.app` (spots page)
2. A red **"Log QSO"** button appears next to each Respot button
3. Click it → a modal opens pre-filled with spot data
4. Review / edit the QSO fields
5. Click **"Log to QRZ"** → the QSO is submitted to your QRZ logbook via ADIF POST

### ADIF Fields Submitted

| ADIF Field | Source |
|---|---|
| `CALL` | Activator callsign from spot |
| `STATION_CALLSIGN` | Your callsign from settings |
| `BAND` | Derived from frequency |
| `MODE` | From spot (e.g., SSB, CW, FT8) |
| `QSO_DATE` | Current UTC date |
| `TIME_ON` | Current UTC time |
| `FREQ` | Frequency in MHz from spot |
| `RST_SENT` | From settings (default 59) |
| `RST_RCVD` | From settings (default 59) |
| `COMMENT` | Auto-filled with POTA park ref (e.g., `POTA US-1234`) |

---

## Limitations & Notes

- **Time accuracy**: QSO time is set to when you click "Log QSO". If you make the contact before clicking, edit the time in the modal.
- **RST**: POTA contacts are typically logged as 59/59. Edit in the modal for actual signal reports.
- **Mode detection**: The extension parses the mode from the spot text. If not found, it uses your configured default.
- **QRZ subscription**: The Logbook API requires an active QRZ XML subscription. Free accounts cannot use the API.
- **pota.app DOM**: If pota.app updates their HTML structure, button injection selectors may need updating.

---

## Files

```
pota-qrz-extension/
├── manifest.json      — Chrome extension manifest (v3)
├── content.js         — Injected into pota.app: adds Log buttons, modal, QRZ API calls
├── content.css        — Styles for buttons and modal
├── popup.html         — Settings popup
├── popup.js           — Saves/loads settings via chrome.storage.sync
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Privacy

- Your QRZ API key is stored locally in Chrome's `storage.sync` (synced across your signed-in Chrome devices)
- No data is sent anywhere except directly to `https://logbook.qrz.com/api` when you click "Log to QRZ"
- The extension does not collect or transmit any analytics

---

## License

MIT — Use freely. Not affiliated with POTA or QRZ.com.
