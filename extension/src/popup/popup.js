// Popup: on/off toggle, the single threshold slider, a per-site override and
// the demoted counter for the current page.

import { loadSettings, saveSettings, effectiveFor } from '../settings.js';

const api = globalThis.chrome || globalThis.browser;

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

async function currentTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  const settings = await loadSettings();
  const tab = await currentTab();
  const host = hostOf(tab?.url || '');
  const eff = effectiveFor(settings, host);

  const enabled = document.getElementById('enabled');
  const threshold = document.getElementById('threshold');
  const thresholdValue = document.getElementById('thresholdValue');
  const siteEnabled = document.getElementById('siteEnabled');
  const hostLabel = document.getElementById('host');
  const count = document.getElementById('count');

  enabled.checked = settings.enabled;
  threshold.value = eff.threshold;
  thresholdValue.textContent = eff.threshold;
  siteEnabled.checked = eff.enabled;
  hostLabel.textContent = host || 'this site';

  // Live badge count for this tab.
  if (tab) {
    api.action.getBadgeText({ tabId: tab.id }, (text) => {
      count.textContent = text || '0';
    });
  }

  enabled.addEventListener('change', () => saveSettings({ enabled: enabled.checked }));

  threshold.addEventListener('input', () => {
    thresholdValue.textContent = threshold.value;
  });
  threshold.addEventListener('change', () => {
    // Writing the global threshold; per-site override for threshold lives in
    // options to keep the popup to one clear dial.
    saveSettings({ threshold: Number(threshold.value) });
  });

  siteEnabled.addEventListener('change', async () => {
    const s = await loadSettings();
    const perSite = { ...(s.perSite || {}) };
    perSite[host] = { ...(perSite[host] || {}), enabled: siteEnabled.checked };
    await saveSettings({ perSite });
  });

  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    api.runtime.openOptionsPage();
  });
}

init();
