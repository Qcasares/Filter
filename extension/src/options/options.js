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

  // Per-site exceptions. Held in a local object and written on save.
  const sitesEl = document.getElementById('sites');
  let perSite = { ...(settings.perSite || {}) };

  function renderSites() {
    sitesEl.innerHTML = '';
    const hosts = Object.keys(perSite).sort();
    if (!hosts.length) {
      sitesEl.innerHTML = '<p class="muted">No site exceptions yet.</p>';
      return;
    }
    for (const host of hosts) {
      const entry = perSite[host] || {};
      const row = document.createElement('div');
      row.className = 'row';
      row.style.margin = '6px 0';

      const on = document.createElement('input');
      on.type = 'checkbox';
      on.checked = entry.enabled !== false;
      on.addEventListener('change', () => { perSite[host] = { ...perSite[host], enabled: on.checked }; });

      const name = document.createElement('span');
      name.textContent = host;
      name.style.flex = '1';

      const thr = document.createElement('input');
      thr.type = 'number';
      thr.min = '0';
      thr.max = '100';
      thr.placeholder = 'global';
      thr.style.width = '80px';
      if (typeof entry.threshold === 'number') thr.value = entry.threshold;
      thr.addEventListener('change', () => {
        const v = thr.value.trim();
        perSite[host] = { ...perSite[host] };
        if (v === '') delete perSite[host].threshold;
        else perSite[host].threshold = Math.max(0, Math.min(100, Number(v)));
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Remove';
      del.style.background = '#888';
      del.addEventListener('click', () => { delete perSite[host]; renderSites(); });

      row.append(on, name, thr, del);
      sitesEl.append(row);
    }
  }
  renderSites();

  document.getElementById('addSite').addEventListener('click', () => {
    const input = document.getElementById('newSite');
    const host = input.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (host && !perSite[host]) { perSite[host] = { enabled: true }; input.value = ''; renderSites(); }
  });

  document.getElementById('save').addEventListener('click', async () => {
    const allowlistCategories = [...cats.querySelectorAll('input:checked')].map((c) => c.value);
    await saveSettings({
      enabled: enabled.checked,
      threshold: Number(threshold.value),
      genericFallback: genericFallback.checked,
      allowlistCategories,
      perSite,
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
