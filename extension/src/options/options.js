// Full settings page: enable, threshold, generic fallback, topic allowlist and
// the cloud classifier credentials.

import { loadSettings, saveSettings } from '../settings.js';

const api = globalThis.chrome || globalThis.browser;
const CATEGORIES = ['politics', 'sport', 'technology', 'society'];

async function init() {
  const settings = await loadSettings();

  const enabled = document.getElementById('enabled');
  const threshold = document.getElementById('threshold');
  const thresholdValue = document.getElementById('thresholdValue');
  const genericFallback = document.getElementById('genericFallback');
  const apiBase = document.getElementById('apiBase');
  const apiKey = document.getElementById('apiKey');
  const cats = document.getElementById('cats');

  enabled.checked = settings.enabled;
  threshold.value = settings.threshold;
  thresholdValue.textContent = settings.threshold;
  genericFallback.checked = settings.genericFallback;
  apiBase.value = settings.apiBase || '';
  apiKey.value = settings.apiKey || '';

  for (const cat of CATEGORIES) {
    const wrap = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = cat;
    cb.checked = (settings.allowlistCategories || []).includes(cat);
    wrap.append(cb, document.createTextNode(cat));
    cats.append(wrap);
  }

  threshold.addEventListener('input', () => {
    thresholdValue.textContent = threshold.value;
  });

  document.getElementById('save').addEventListener('click', async () => {
    const allowlistCategories = [...cats.querySelectorAll('input:checked')].map((c) => c.value);
    await saveSettings({
      enabled: enabled.checked,
      threshold: Number(threshold.value),
      genericFallback: genericFallback.checked,
      allowlistCategories,
      apiBase: apiBase.value.trim().replace(/\/$/, ''),
      apiKey: apiKey.value.trim()
    });
    // Ask the background to refresh selector configs now that credentials exist.
    api.runtime.sendMessage({ type: 'refreshSelectors' });
    const status = document.getElementById('status');
    status.textContent = 'Saved';
    setTimeout(() => { status.textContent = ''; }, 1500);
  });
}

init();
