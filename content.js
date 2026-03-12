// POTA → QRZ Logger - Content Script
// Strategy: Instead of trying to inject into pota.app's dynamic Vue DOM,
// we fetch spots directly from the POTA public API and render our own
// floating panel with Log QSO buttons. Reliable across any DOM changes.

(function () {
  'use strict';

  const POTA_API   = 'https://api.pota.app/spot/activator';
  const REFRESH_MS = 60_000;

  let config = {
    qrzApiKey: '',
    myCallsign: '',
  };

  let spots = [];
  let panelOpen = false;
  let refreshTimer = null;
  let filterText = '';

  // ─── Bootstrap ───────────────────────────────────────────────────────────────
  chrome.storage.sync.get(['qrzApiKey', 'myCallsign'], (stored) => {
    config = { ...config, ...stored };
    injectPanel();
    fetchAndRender();
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      config[key] = newValue;
    }
  });

  // ─── Build floating panel + FAB ──────────────────────────────────────────────
  function injectPanel() {
    if (document.getElementById('pqrz-launcher')) return;

    const fab = document.createElement('button');
    fab.id = 'pqrz-launcher';
    fab.title = 'K4RGB - POTA → QRZ Logger';
    fab.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
      <span id="pqrz-badge" class="pqrz-badge pqrz-badge--hidden">0</span>`;
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'pqrz-panel';
    panel.setAttribute('aria-label', 'K4RGB - POTA → QRZ Logger');
    panel.innerHTML = `
      <div class="pqrz-panel-header">
        <span class="pqrz-panel-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          K4RGB - POTA → QRZ Logger
        </span>
        <div class="pqrz-panel-controls">
          <button id="pqrz-refresh-btn" title="Refresh spots" class="pqrz-icon-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <button id="pqrz-close-btn" title="Close" class="pqrz-icon-btn">&#x2715;</button>
        </div>
      </div>
      <div class="pqrz-search-wrap">
        <input id="pqrz-filter" type="text" placeholder="Filter by call, park, mode, freq&#x2026;" autocomplete="off" spellcheck="false" />
      </div>
      <div id="pqrz-spots-list">
        <div class="pqrz-loading">
          <div class="pqrz-spinner"></div>
          Loading spots&#x2026;
        </div>
      </div>
      <div class="pqrz-panel-footer">
        Auto-refreshes every 60 s &nbsp;&#xB7;&nbsp;
        Last: <span id="pqrz-last-updated">Never</span>
      </div>`;

    document.body.appendChild(panel);

    document.getElementById('pqrz-close-btn').addEventListener('click', () => {
      panelOpen = false;
      panel.classList.remove('pqrz-panel--open');
      clearFilter();
    });
    document.getElementById('pqrz-refresh-btn').addEventListener('click', () => fetchAndRender(true));
    document.getElementById('pqrz-filter').addEventListener('input', (e) => {
      filterText = e.target.value.toLowerCase();
      renderSpotsList();
    });
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    document.getElementById('pqrz-panel').classList.toggle('pqrz-panel--open', panelOpen);
    if (panelOpen) {
      document.getElementById('pqrz-launcher').blur();
      setTimeout(() => document.getElementById('pqrz-filter')?.focus(), 250);
    } else {
      clearFilter();
    }
  }

  function clearFilter() {
    filterText = '';
    const filterEl = document.getElementById('pqrz-filter');
    if (filterEl) filterEl.value = '';
    renderSpotsList();
  }

  // ─── Fetch spots from POTA API ────────────────────────────────────────────────
  async function fetchAndRender(showSpinner = false) {
    clearTimeout(refreshTimer);
    const listEl = document.getElementById('pqrz-spots-list');
    if (showSpinner && listEl) {
      listEl.innerHTML = `<div class="pqrz-loading"><div class="pqrz-spinner"></div>Loading spots&#x2026;</div>`;
    }
    try {
      const resp = await fetch(POTA_API, { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      spots = await resp.json();

      const badge = document.getElementById('pqrz-badge');
      if (badge) {
        badge.textContent = spots.length;
        badge.classList.toggle('pqrz-badge--hidden', spots.length === 0);
      }
      renderSpotsList();
      const lu = document.getElementById('pqrz-last-updated');
      if (lu) lu.textContent = new Date().toLocaleTimeString();
    } catch (err) {
      if (listEl) listEl.innerHTML = `<div class="pqrz-error">Could not load spots: ${err.message}</div>`;
    }
    refreshTimer = setTimeout(() => fetchAndRender(), REFRESH_MS);
  }

  // ─── Render spots list ────────────────────────────────────────────────────────
  function renderSpotsList() {
    const listEl = document.getElementById('pqrz-spots-list');
    if (!listEl) return;

    const filtered = spots.filter(s => {
      if (!filterText) return true;
      const freqKHz = String(s.frequency || '');
      const freqMHz = s.frequency ? (parseFloat(s.frequency) / 1000).toFixed(4) : '';
      return [s.activator, s.reference, s.mode, s.name, s.locationDesc, freqKHz, freqMHz]
        .some(v => (v || '').toLowerCase().includes(filterText));
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="pqrz-empty">No spots${filterText ? ' matching filter' : ''}.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(spot => {
      const freqMHz = (parseFloat(spot.frequency) / 1000).toFixed(4);
      const band    = freqToBand(freqMHz);
      const mc      = modeClass(spot.mode);
      return `
        <div class="pqrz-spot">
          <div class="pqrz-spot-main">
            <span class="pqrz-call">${esc(spot.activator)}</span>
            <span class="pqrz-mode pqrz-mode--${mc}">${esc(spot.mode)}</span>
            <span class="pqrz-freq">${parseFloat(spot.frequency).toLocaleString()} kHz</span>
          </div>
          <div class="pqrz-spot-sub">
            <span class="pqrz-park">${esc(spot.reference)} &middot; ${esc(spot.locationDesc || '')}</span>
            <span class="pqrz-time">${formatSpotTime(spot.spotTime)}</span>
          </div>
          ${spot.comments ? `<div class="pqrz-comments">${esc(spot.comments)}</div>` : ''}
          <button class="pqrz-log-btn"
            data-activator="${esc(spot.activator)}"
            data-freq="${freqMHz}"
            data-band="${esc(band)}"
            data-mode="${esc(spot.mode)}"
            data-park="${esc(spot.reference)}"
            data-name="${esc(spot.name || '')}"
            data-location="${esc(spot.locationDesc || '')}"
            data-grid="${esc(spot.grid4 || '')}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Log QSO
          </button>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.pqrz-log-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const now     = new Date();
        const qsoDate = now.toISOString().slice(0,10).replace(/-/g,'');
        const timeOn  = now.toISOString().slice(11,16).replace(':','');
        const d = btn.dataset;
        // Parse a single US state from locationDesc (e.g. "US-AZ" -> "AZ").
        // If multiple states (comma-separated) or non-US, leave blank.
        const locParts = (d.location || '').split(',').map(s => s.trim());
        const isMulti = locParts.length > 1;
        let state = '';
        if (!isMulti && locParts[0]) {
          const m = locParts[0].match(/^US-([A-Z]{2})$/);
          if (m) state = m[1];
        }
        const grid = isMulti ? '' : (d.grid || '');
        showModal({ activator: d.activator, freq: d.freq, band: d.band, mode: d.mode,
                    park: d.park, name: d.name, state, grid, qsoDate, timeOn });
      });
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatSpotTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
      return d.toUTCString().slice(17,22) + ' UTC';
    } catch { return ''; }
  }
  function modeClass(mode) {
    const m = (mode||'').toUpperCase();
    if (m === 'CW') return 'cw';
    if (['FT8','FT4','RTTY','PSK31','JS8','DIGITAL'].includes(m)) return 'digital';
    if (['SSB','USB','LSB','AM','FM'].includes(m)) return 'phone';
    return 'other';
  }
  function freqToBand(f) {
    f = parseFloat(f);
    if (f>=1.8&&f<=2.0)    return '160m';
    if (f>=3.5&&f<=4.0)    return '80m';
    if (f>=5.3&&f<=5.4)    return '60m';
    if (f>=7.0&&f<=7.3)    return '40m';
    if (f>=10.1&&f<=10.15) return '30m';
    if (f>=14.0&&f<=14.35) return '20m';
    if (f>=18.068&&f<=18.168) return '17m';
    if (f>=21.0&&f<=21.45) return '15m';
    if (f>=24.89&&f<=24.99) return '12m';
    if (f>=28.0&&f<=29.7)  return '10m';
    if (f>=50.0&&f<=54.0)  return '6m';
    if (f>=144.0&&f<=148.0)return '2m';
    return '';
  }

  // ─── Log QSO Modal ────────────────────────────────────────────────────────────
  function showModal(spotData) {
    if (!config.qrzApiKey) { showToast('No QRZ API key set — click the extension icon to configure.', 'warn'); return; }
    if (!config.myCallsign) { showToast('No callsign set — click the extension icon to configure.', 'warn'); return; }

    document.getElementById('pqrz-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pqrz-modal';
    const modes = ['SSB','USB','LSB','CW','FT8','FT4','AM','FM','RTTY','PSK31','JS8','DIGITAL'];
    overlay.innerHTML = `
      <div class="pqrz-backdrop"></div>
      <div class="pqrz-dialog" role="dialog" aria-modal="true">
        <header class="pqrz-dialog-header">
          <span>&#x1F4E1;</span>
          <h2>Log QSO to QRZ</h2>
          <button class="pqrz-dialog-close">&#x2715;</button>
        </header>
        <div class="pqrz-dialog-body">
          <div class="pqrz-form-grid">
            <div class="pqrz-form-field"><label>Their Call <span class="req">*</span></label>
              <input id="pqrz-f-call" type="text" value="${esc(spotData.activator)}" maxlength="20"/></div>
            <div class="pqrz-form-field"><label>My Call <span class="req">*</span></label>
              <input id="pqrz-f-mycall" type="text" value="${esc(config.myCallsign)}" maxlength="20"/></div>
            <div class="pqrz-form-field"><label>Frequency (MHz)</label>
              <input id="pqrz-f-freq" type="text" value="${esc(spotData.freq)}" maxlength="12"/></div>
            <div class="pqrz-form-field"><label>Band <span class="req">*</span></label>
              <input id="pqrz-f-band" type="text" value="${esc(spotData.band)}" maxlength="6"/></div>
            <div class="pqrz-form-field"><label>RST Sent</label>
              <input id="pqrz-f-rsts" type="text" value="" maxlength="3" class="pqrz-input--warn"/></div>
            <div class="pqrz-form-field"><label>RST Rcvd</label>
              <input id="pqrz-f-rstr" type="text" value="" maxlength="3" class="pqrz-input--warn"/></div>
            <div class="pqrz-form-field"><label>Date (UTC)</label>
              <input id="pqrz-f-date" type="text" value="${esc(spotData.qsoDate)}" maxlength="8"/></div>
            <div class="pqrz-form-field">
              <label>Time On (UTC)
                <button type="button" id="pqrz-time-toggle" class="pqrz-time-toggle pqrz-time-toggle--running" title="Pause / set to current time">
                  <svg class="pqrz-icon-pause" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  <svg class="pqrz-icon-play" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:none"><polygon points="5,3 19,12 5,21"/></svg>
                </button>
              </label>
              <input id="pqrz-f-time" type="text" value="${esc(spotData.timeOn)}" maxlength="4"/>
            </div>
            <div class="pqrz-form-field"><label>Mode <span class="req">*</span></label>
              <select id="pqrz-f-mode">${modes.map(m=>`<option value="${m}"${m===spotData.mode?' selected':''}>${m}</option>`).join('')}</select></div>
            <div class="pqrz-form-field pqrz-form-field--full"><label>Comment</label>
              <input id="pqrz-f-comment" type="text"
                value="POTA hunting"
                placeholder="POTA hunting" maxlength="120"/></div>
            <div class="pqrz-form-field pqrz-form-field--full"><label>QTH (Park Name)</label>
              <input id="pqrz-f-qth" type="text"
                value="${spotData.park && spotData.name ? esc(spotData.park) + ' ' + esc(spotData.name) : esc(spotData.name || spotData.park || '')}"
                placeholder="Park name" maxlength="120"/></div>
            <div class="pqrz-form-field"><label>State</label>
              <input id="pqrz-f-state" type="text"
                value="${esc(spotData.state || '')}"
                placeholder="" maxlength="2"
                class="${spotData.state ? '' : 'pqrz-input--warn'}"/></div>
            <div class="pqrz-form-field"><label>Their Grid Square</label>
              <input id="pqrz-f-grid" type="text"
                value="${esc(spotData.grid || '')}"
                placeholder="" maxlength="8"/></div>
          </div>
          <div class="pqrz-dialog-status" id="pqrz-modal-status" aria-live="polite"></div>
        </div>
        <footer class="pqrz-dialog-footer">
          <button class="pqrz-btn pqrz-btn--cancel">Cancel</button>
          <button class="pqrz-btn pqrz-btn--submit" id="pqrz-modal-submit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Log to QRZ
          </button>
        </footer>
      </div>`;

    document.body.appendChild(overlay);
    // Live UTC time ticker — updates the time field every second while running
    let timeTicking = true;
    let timeTickInterval = setInterval(() => {
      if (!timeTicking) return;
      const now = new Date();
      const timeField = overlay.querySelector('#pqrz-f-time');
      if (timeField) timeField.value = now.toISOString().slice(11, 16).replace(':', '');
    }, 1000);

    const close = () => {
      clearInterval(timeTickInterval);
      overlay.remove();
    };
    overlay.querySelector('.pqrz-backdrop').addEventListener('click', close);

    // Helper: update toggle button appearance to match timeTicking state
    const timeInput  = overlay.querySelector('#pqrz-f-time');
    const timeToggle = overlay.querySelector('#pqrz-time-toggle');

    function setTimeTicking(running) {
      timeTicking = running;
      timeToggle.classList.toggle('pqrz-time-toggle--running', running);
      timeToggle.querySelector('.pqrz-icon-pause').style.display = running ? '' : 'none';
      timeToggle.querySelector('.pqrz-icon-play').style.display  = running ? 'none' : '';
      timeToggle.title = running ? 'Pause time' : 'Resume to current time';
    }

    // Editing the time field pauses the ticker automatically
    timeInput.addEventListener('input', () => {
      if (timeTicking) setTimeTicking(false);
    });

    // Play / pause button
    timeToggle.addEventListener('click', () => {
      const running = !timeTicking;
      setTimeTicking(running);
      if (running) {
        // Snap immediately to current time when resuming
        const now = new Date();
        timeInput.value = now.toISOString().slice(11, 16).replace(':', '');
      }
    });
    // Remove warning border on RST fields as the user types
    ['pqrz-f-rsts', 'pqrz-f-rstr'].forEach(id => {
      const el = overlay.querySelector('#' + id);
      el.addEventListener('input', () => {
        el.classList.toggle('pqrz-input--warn', el.value.trim() === '');
      });
    });

    overlay.querySelector('.pqrz-dialog-close').addEventListener('click', close);
    overlay.querySelector('.pqrz-btn--cancel').addEventListener('click', close);

    overlay.querySelector('#pqrz-modal-submit').addEventListener('click', async () => {
      const submitBtn = overlay.querySelector('#pqrz-modal-submit');
      const statusEl  = overlay.querySelector('#pqrz-modal-status');
      const qso = {
        call:             overlay.querySelector('#pqrz-f-call').value.trim().toUpperCase(),
        station_callsign: overlay.querySelector('#pqrz-f-mycall').value.trim().toUpperCase(),
        freq:             overlay.querySelector('#pqrz-f-freq').value.trim(),
        band:             overlay.querySelector('#pqrz-f-band').value.trim(),
        mode:             overlay.querySelector('#pqrz-f-mode').value,
        rst_sent:         overlay.querySelector('#pqrz-f-rsts').value.trim(),
        rst_rcvd:         overlay.querySelector('#pqrz-f-rstr').value.trim(),
        qso_date:         overlay.querySelector('#pqrz-f-date').value.trim(),
        time_on:          overlay.querySelector('#pqrz-f-time').value.trim(),
        comment:          overlay.querySelector('#pqrz-f-comment').value.trim(),
        qth:              overlay.querySelector('#pqrz-f-qth').value.trim(),
        state:            overlay.querySelector('#pqrz-f-state').value.trim().toUpperCase(),
        gridsquare:       overlay.querySelector('#pqrz-f-grid').value.trim().toUpperCase(),
      };
      if (!qso.call || !qso.station_callsign || !qso.band || !qso.mode) {
        statusEl.textContent = 'Their Call, My Call, Band and Mode are required.';
        statusEl.className = 'pqrz-dialog-status pqrz-dialog-status--error';
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging\u2026';
      statusEl.textContent = '';
      try {
        const result = await logToQRZ(qso);
        const logid = result.logid || '';
        const logidIsNumber = logid !== '' && /^\d+$/.test(logid);
        if (logidIsNumber) {
          statusEl.innerHTML = `Logged! QRZ log ID: <strong>${logid}</strong>`;
          statusEl.className = 'pqrz-dialog-status pqrz-dialog-status--success';
          submitBtn.textContent = '\u2713 Done';
          respotOnPota({ activator: qso.call, spotter: qso.station_callsign,
                         freqMHz: qso.freq, reference: spotData.park, mode: qso.mode, comments: qso.rst_sent });
          setTimeout(close, 2500);
        } else {
          statusEl.innerHTML = `Error \u2014 Please check QRZ API key.`;
          statusEl.className = 'pqrz-dialog-status pqrz-dialog-status--error';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Retry';
        }
      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.className = 'pqrz-dialog-status pqrz-dialog-status--error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Retry';
      }
    });
  }

  // ─── POTA Respot ─────────────────────────────────────────────────────────────
  function respotOnPota({ activator, spotter, freqMHz, reference, mode, comments }) {
    const frequency = String(Math.round(parseFloat(freqMHz) * 1000));
    chrome.runtime.sendMessage(
      { type: 'POTA_RESPOT', payload: { activator, spotter, frequency, reference, mode, comments } },
      (response) => {
        if (response?.ok) {
          showToast('Respotted on POTA ✓', 'info');
        } else {
          showToast('POTA respot failed: ' + (response?.error || 'unknown error'), 'warn');
        }
      }
    );
  }

  // ─── QRZ API ──────────────────────────────────────────────────────────────────
  // QRZ API calls are proxied through background.js to avoid CORS errors.
  // Content scripts run in the page context and are blocked by CORS;
  // the background service worker is not subject to those restrictions.
  async function logToQRZ(qso) {
    const f = (tag, val) => { if (!val) return ''; const s = String(val); return `<${tag}:${s.length}>${s}`; };
    const adif = [
      f('CALL',qso.call), f('STATION_CALLSIGN',qso.station_callsign),
      f('BAND',qso.band), f('MODE',qso.mode), f('QSO_DATE',qso.qso_date),
      f('TIME_ON',qso.time_on), f('FREQ',qso.freq), f('RST_SENT',qso.rst_sent),
      f('RST_RCVD',qso.rst_rcvd), f('COMMENT',qso.comment),
      f('QTH',qso.qth), f('STATE',qso.state),
      f('GRIDSQUARE',qso.gridsquare), '<EOR>',
    ].join('');

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'QRZ_LOG', payload: { apiKey: config.qrzApiKey, adif } },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response || !response.ok) {
            reject(new Error(response?.error || 'No response from background worker'));
          } else {
            resolve(response.result);
          }
        }
      );
    });
  }

  // ─── Toast ────────────────────────────────────────────────────────────────────
  function showToast(message, type = 'info', duration = 4500) {
    document.querySelector('.pqrz-toast')?.remove();
    const t = document.createElement('div');
    t.className = `pqrz-toast pqrz-toast--${type}`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), duration);
  }
})();
