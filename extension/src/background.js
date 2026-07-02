// Service worker: the single place where classification, caching and the API
// client come together. Content scripts stay thin and just ask the background
// to score batches of headlines.

import { scoreHeadline, isConfident } from './classify/rules.js';
import { hashHeadline, createCache } from './classify/cache.js';
import { RemoteClassifier } from './classify/remote.js';
import { loadSettings, DEFAULT_SETTINGS } from './settings.js';
import { applyAllowlist } from './classify/adjust.js';
import { fetchSelectorUpdates, SELECTOR_STORE_KEY } from './content/selectors.js';

const cache = createCache();
const SELECTOR_ALARM = 'hemisphere-selectors';

// Seed defaults on install so the options and popup pages have a full model.
chrome.runtime.onInstalled.addListener(async () => {
  const current = await loadSettings();
  chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...current });
  chrome.alarms.create(SELECTOR_ALARM, { periodInMinutes: 60 * 24 });
});

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === SELECTOR_ALARM) refreshSelectors();
});

async function refreshSelectors() {
  const settings = await loadSettings();
  const configs = await fetchSelectorUpdates(settings);
  if (configs) await chrome.storage.local.set({ [SELECTOR_STORE_KEY]: configs });
}

/**
 * Classify a batch of candidate headlines through the three tiers.
 * @param {{text:string}[]} items
 * @param {string} host
 * @returns {Promise<{verdicts:object[], degraded:boolean}>}
 */
async function classifyBatch(items, host) {
  const settings = await loadSettings();
  const remote = new RemoteClassifier({ apiBase: settings.apiBase, apiKey: settings.apiKey });

  const verdicts = new Array(items.length);
  const unresolved = [];

  // Tier 1: local rules. Confident verdicts are used immediately.
  for (let i = 0; i < items.length; i++) {
    const hash = await hashHeadline(items[i].text);
    const rules = scoreHeadline(items[i].text, { host });
    const base = { hash, ...rules };
    if (isConfident(rules)) {
      verdicts[i] = base;
    } else {
      verdicts[i] = base; // provisional; may be overwritten below
      unresolved.push({ index: i, hash, text: items[i].text });
    }
  }

  // Tier 2: cache for the ambiguous ones.
  const stillUnknown = [];
  for (const u of unresolved) {
    const cached = await cache.get(u.hash);
    if (cached) verdicts[u.index] = { ...verdicts[u.index], ...cached };
    else stillUnknown.push(u);
  }

  // Tier 3: remote LLM for true misses.
  let degraded = false;
  if (stillUnknown.length && remote.configured) {
    const resolved = await remote.classify(stillUnknown);
    degraded = remote.degraded;
    for (const u of stillUnknown) {
      const r = resolved.get(u.hash);
      if (r) {
        verdicts[u.index] = r;
        await cache.set(r);
      }
    }
  }

  // Apply the topic allowlist as category score adjustments (single dial intact:
  // this shifts the score, it does not add a second sensitivity control).
  for (let i = 0; i < verdicts.length; i++) {
    verdicts[i] = applyAllowlist(verdicts[i], settings.allowlistCategories);
  }

  return { verdicts, degraded };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'classify') {
    classifyBatch(msg.items || [], msg.host || '')
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ verdicts: [], degraded: false }));
    return true; // async response
  }

  if (msg?.type === 'demotedCount' && sender.tab) {
    const count = msg.count || 0;
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: count ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#b8860b' });
    return false;
  }

  if (msg?.type === 'refreshSelectors') {
    refreshSelectors().then(() => sendResponse({ ok: true }));
    return true;
  }
});
