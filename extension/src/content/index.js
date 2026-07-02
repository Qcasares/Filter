// Content entry point: pick the site config, scan for headlines, ask the
// background to classify them, and demote anything scoring at or above the
// effective threshold. Stays thin; all classification and caching live in the
// service worker.

import { loadConfigForLocation } from './selectors.js';
import { loadSettings, effectiveFor } from '../settings.js';
import { Scanner } from './scanner.js';
import { demote, undemote, isRevealed } from './demote.js';

const api = globalThis.chrome || globalThis.browser;
const host = location.hostname;
const path = location.pathname;

// el -> { hash, score, ... } for every element we have a verdict for, so a
// threshold change can be re-applied without re-classifying.
const scored = new Map();
let settings = null;
let eff = { enabled: true, threshold: 70 };

function sendClassify(items) {
  return new Promise((resolve) => {
    api.runtime.sendMessage({ type: 'classify', items, host }, (res) => {
      resolve(res || { verdicts: [] });
    });
  });
}

function updateBadge() {
  let count = 0;
  for (const el of scored.keys()) if (el.dataset.hemiDemoted === '1') count++;
  api.runtime.sendMessage({ type: 'demotedCount', count });
}

function applyDecision(el) {
  const rec = scored.get(el);
  if (!rec) return;
  const shouldDemote = eff.enabled && !isRevealed(rec.hash) && rec.score >= eff.threshold;
  const isDemoted = el.dataset.hemiDemoted === '1';
  if (shouldDemote && !isDemoted) demote(el, rec.hash, { onReveal: updateBadge });
  else if (!shouldDemote && isDemoted) undemote(el);
}

async function handleBatch(cands) {
  const items = cands.map((c) => ({ text: c.text }));
  const { verdicts } = await sendClassify(items);
  for (let i = 0; i < cands.length; i++) {
    const v = verdicts[i];
    if (!v) continue;
    scored.set(cands[i].el, v);
    applyDecision(cands[i].el);
  }
  updateBadge();
}

function onSettingsChanged() {
  loadSettings().then((s) => {
    settings = s;
    eff = effectiveFor(s, host);
    for (const el of scored.keys()) applyDecision(el);
    updateBadge();
  });
}

async function main() {
  settings = await loadSettings();
  eff = effectiveFor(settings, host);

  const config = await loadConfigForLocation(host, path, { allowGeneric: settings.genericFallback });
  if (!config) return; // no config for this site and generic fallback is off

  const scanner = new Scanner(config, { onBatch: handleBatch });
  scanner.start();
  if (api.storage?.onChanged) api.storage.onChanged.addListener(onSettingsChanged);
}

main();
