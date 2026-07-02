// Shared settings model, stored in chrome.storage.sync so it follows the owner
// across their signed-in browsers. There is exactly one sensitivity mechanism:
// `threshold`. Nothing here may introduce a second competing dial.

export const DEFAULT_SETTINGS = {
  enabled: true,
  threshold: 70,            // demote items scoring at or above this
  perSite: {},              // host -> { enabled?:bool, threshold?:number }
  allowlistCategories: [],  // categories to keep even when US, e.g. ['technology']
  genericFallback: false,   // scan unknown news-like sites with h1-h3/article
  apiBase: '',              // owner's Vercel deployment origin, e.g. https://hemisphere.vercel.app
  apiKey: ''                // shared secret, matches API_KEY on the server
};

// Read settings, merged over defaults. Works on Chrome (callback) and Firefox
// (promise) via feature detection.
export async function loadSettings(area = globalThis.chrome?.storage?.sync) {
  if (!area) return { ...DEFAULT_SETTINGS };
  const stored = await new Promise((resolve) => {
    const maybe = area.get(DEFAULT_SETTINGS, (res) => resolve(res || {}));
    if (maybe && typeof maybe.then === 'function') maybe.then(resolve);
  });
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch, area = globalThis.chrome?.storage?.sync) {
  if (!area) return;
  await new Promise((resolve) => {
    const maybe = area.set(patch, () => resolve());
    if (maybe && typeof maybe.then === 'function') maybe.then(resolve);
  });
}

// Resolve the effective enabled state and threshold for a given host, applying
// any per-site override on top of the global settings.
export function effectiveFor(settings, host) {
  const override = (settings.perSite && settings.perSite[host]) || {};
  return {
    enabled: settings.enabled && override.enabled !== false,
    threshold: typeof override.threshold === 'number' ? override.threshold : settings.threshold
  };
}
