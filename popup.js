// popup.js - Handles settings save/load for POTA → QRZ Logger

const KEYS = ['qrzApiKey', 'myCallsign'];

// ─── Load saved settings ──────────────────────────────────────────────────────
chrome.storage.sync.get(KEYS, (stored) => {
  for (const key of KEYS) {
    const el = document.getElementById(key);
    if (el && stored[key] !== undefined) el.value = stored[key];
  }
});

// ─── API key show/hide toggle ─────────────────────────────────────────────────
document.getElementById('toggleApiKey').addEventListener('click', () => {
  const input   = document.getElementById('qrzApiKey');
  const eyeShow = document.getElementById('eye-show');
  const eyeHide = document.getElementById('eye-hide');
  const isHidden = input.type === 'password';
  input.type       = isHidden ? 'text' : 'password';
  eyeShow.style.display = isHidden ? 'none' : '';
  eyeHide.style.display = isHidden ? '' : 'none';
});

// ─── Save settings ────────────────────────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', () => {
  const data = {};
  for (const key of KEYS) {
    const el = document.getElementById(key);
    if (el) data[key] = el.value.trim();
  }
  if (data.myCallsign) data.myCallsign = data.myCallsign.toUpperCase();

  chrome.storage.sync.set(data, () => {
    const status = document.getElementById('status');
    if (chrome.runtime.lastError) {
      status.textContent = '❌ Error saving: ' + chrome.runtime.lastError.message;
      status.className = 'show err';
    } else {
      status.textContent = '✅ Settings saved!';
      status.className = 'show ok';
      setTimeout(() => { status.className = ''; }, 2500);
    }
  });
});
