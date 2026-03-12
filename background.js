// background.js — POTA → QRZ Logger
// Runs as a service worker. All outbound fetches to QRZ and POTA happen here,
// bypassing the CORS restrictions that block calls from content scripts.

const QRZ_API = 'https://logbook.qrz.com/api';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'QRZ_LOG') {
    handleQrzLog(message.payload)
      .then(result => sendResponse({ ok: true, result }))
      .catch(err  => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.type === 'QRZ_VERIFY') {
    handleQrzVerify(message.payload)
      .then(result => sendResponse({ ok: true, result }))
      .catch(err  => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.type === 'POTA_RESPOT') {
    handlePotaRespot(message.payload)
      .then(result => sendResponse({ ok: true, result }))
      .catch(err  => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function handleQrzLog({ apiKey, adif }) {
  const body = new URLSearchParams({ KEY: apiKey, ACTION: 'INSERT', ADIF: adif });

  const resp = await fetch(QRZ_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);

  const text = await resp.text();

  // QRZ responds with URL-encoded key=value pairs, e.g. RESULT=OK&LOGID=123
  const result = {};
  text.split('&').forEach(pair => {
    const eq = pair.indexOf('=');
    if (eq === -1) return;
    const k = decodeURIComponent(pair.slice(0, eq));
    const v = decodeURIComponent(pair.slice(eq + 1));
    result[k] = v;
  });

  const r = result.RESULT || result.result || '';
  if (r === 'FAIL') {
    throw new Error(result.REASON || result.reason || 'QRZ returned FAIL with no reason');
  }

  return { logid: result.LOGID || result.logid || 'OK' };
}

async function handlePotaRespot({ activator, spotter, frequency, reference, mode, comments }) {
  const resp = await fetch('https://api.pota.app/spot/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://pota.app',
      'Referer': 'https://pota.app/',
    },
    body: JSON.stringify({ activator, spotter, frequency, reference, mode, source: 'pota-qrz-logger', comments }),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  return { ok: true };
}

async function handleQrzVerify({ apiKey }) {
  const body = new URLSearchParams({ KEY: apiKey, ACTION: 'STATUS' });

  const resp = await fetch(QRZ_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);

  const text = await resp.text();

  const result = {};
  text.split('&').forEach(pair => {
    const eq = pair.indexOf('=');
    if (eq === -1) return;
    const k = decodeURIComponent(pair.slice(0, eq));
    const v = decodeURIComponent(pair.slice(eq + 1));
    result[k] = v;
  });

  const r = result.RESULT || result.result || '';
  if (r === 'FAIL') {
    throw new Error(result.REASON || result.reason || 'Invalid API key');
  }

  // Return useful info from the STATUS response to show the user
  return {
    callsign: result.CALLSIGN || result.callsign || '',
    count:    result.COUNT    || result.count    || '',
  };
}
