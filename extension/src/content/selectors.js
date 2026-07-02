// Selector config loading and remote updates.
//
// The extension ships with bundled defaults (sites/index.js). Once a day the
// background worker fetches newer configs from /api/selectors and stores them
// in chrome.storage.local; content scripts read the merged view so a broken
// selector can be repaired server-side.

import { DEFAULT_CONFIGS, pickConfig } from './sites/index.js';

export const SELECTOR_STORE_KEY = 'hemi:selectors';

// Merge stored configs over bundled defaults, taking whichever has the higher
// version number per site id.
export function mergeConfigs(defaults, stored) {
  const byId = new Map(defaults.map((c) => [c.id, c]));
  for (const c of stored || []) {
    const existing = byId.get(c.id);
    if (!existing || (c.version || 0) >= (existing.version || 0)) byId.set(c.id, c);
  }
  return [...byId.values()];
}

// Fetch the latest selector configs from the owner's API. Returns an array of
// configs, or null on any failure (caller keeps whatever it already had).
export async function fetchSelectorUpdates(settings, fetchImpl = globalThis.fetch) {
  const base = (settings.apiBase || '').replace(/\/$/, '');
  if (!base || !settings.apiKey) return null;
  try {
    const res = await fetchImpl(`${base}/api/selectors`, {
      headers: { 'x-hemisphere-key': settings.apiKey }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.configs) ? data.configs : null;
  } catch {
    return null;
  }
}

// Load the effective config for a location, using bundled defaults overlaid
// with any stored remote updates.
export async function loadConfigForLocation(host, path, opts = {}) {
  let stored = null;
  const area = globalThis.chrome?.storage?.local;
  if (area) {
    const res = await new Promise((resolve) => {
      const maybe = area.get(SELECTOR_STORE_KEY, (r) => resolve(r || {}));
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve);
    });
    stored = res[SELECTOR_STORE_KEY];
  }
  const configs = mergeConfigs(DEFAULT_CONFIGS, stored);
  return pickConfig(configs, host, path, opts);
}
