// Tier 1: local keyword and entity scoring.
//
// Every tier in Hemisphere returns the same shape:
//   { hash, score, source, confidence }
// This module produces the score, source ('rules'), confidence and a best
// guess category. The hash is attached by the caller using cache.js so that
// the normalisation logic lives in exactly one place (here) and hashing lives
// in exactly one place (cache.js).

import entities from '../../../data/entities-us.json';
import publishers from '../../../data/publishers.json';

const W = entities.weights;

/**
 * Normalise a headline for scoring and hashing: lowercase, strip punctuation,
 * collapse runs of whitespace, trim. This is the canonical normaliser used by
 * both tier 1 scoring and the tier 2 cache key.
 * @param {string} text
 * @returns {string}
 */
export function normalise(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Resolve a hostname to one of the coarse regions in publishers.json. Returns
// null when the domain is unknown so callers can treat it as neutral.
export function regionForHost(host) {
  if (!host) return null;
  const clean = String(host).toLowerCase().replace(/^www\./, '');
  for (const [region, domains] of Object.entries(publishers.regions)) {
    if (domains.some((d) => clean === d || clean.endsWith('.' + d))) return region;
  }
  return null;
}

// Guess the dominant category by counting keyword hits. Used later by the
// topic allowlist so the owner can, for example, keep US technology while
// still demoting US politics. Returns null when nothing matches.
function guessCategory(padded) {
  let best = null;
  let bestHits = 0;
  for (const [category, terms] of Object.entries(entities.categories)) {
    const hits = terms.reduce((n, t) => (padded.includes(` ${t} `) ? n + 1 : n), 0);
    if (hits > bestHits) {
      bestHits = hits;
      best = category;
    }
  }
  return best;
}

/**
 * Score a single headline for US-topic relevance using local rules only.
 * @param {string} headline
 * @param {{ host?: string }} [opts] optional page host for a weak region prior
 * @returns {{ score:number, source:'rules', confidence:number, category:string|null, hits:object }}
 */
export function scoreHeadline(headline, opts = {}) {
  const norm = normalise(headline);
  const padded = ` ${norm} `;
  const has = (term) => padded.includes(` ${term} `);

  const hits = { strong: [], medium: [], weak: [], places: [], counter: [] };
  let usSignal = 0;
  let counterSignal = 0;

  for (const term of entities.strong) {
    if (has(term)) { usSignal += W.strong; hits.strong.push(term); }
  }
  for (const term of entities.medium) {
    if (has(term)) { usSignal += W.medium; hits.medium.push(term); }
  }
  for (const term of entities.weak) {
    if (has(term)) { usSignal += W.weak; hits.weak.push(term); }
  }

  // State and city names contribute a weak base signal on their own.
  for (const place of [...entities.states, ...entities.cities]) {
    if (has(place)) { usSignal += W.weak; hits.places.push(place); }
  }

  // A single political-context boost lifts any already-present US signal when a
  // political keyword is also in the headline. This is what turns "Georgia" the
  // country into "Georgia" the swing state, and "Trump" into "Trump election",
  // without letting context words score anything on their own.
  const politicalPresent = entities.politicalContext.some(has);
  if (usSignal > 0 && politicalPresent) usSignal += W.contextBoost;

  for (const term of entities.counterStrong) {
    if (has(term)) { counterSignal += Math.abs(W.counterStrong); hits.counter.push(term); }
  }
  for (const term of entities.counterMedium) {
    if (has(term)) { counterSignal += Math.abs(W.counterMedium); hits.counter.push(term); }
  }

  // Weak region prior from the publisher domain. Never decisive: the target is
  // US topics, not US publishers.
  const region = regionForHost(opts.host);
  const prior = region ? (publishers.priorNudge[region] || 0) : 0;

  let score = clamp(usSignal - counterSignal + prior, 0, 100);

  // Confidence. High at the ends of the scale, lower in the ambiguous middle,
  // and always capped when US and counter signals conflict so genuinely
  // contested headlines get escalated to the cache or the LLM.
  let confidence = (score <= 25 || score >= 75) ? 0.9 : 0.45;
  confidence = clamp(confidence + Math.min(usSignal + counterSignal, 40) / 400, 0, 0.98);
  if (usSignal > 0 && counterSignal > 0) confidence = Math.min(confidence, 0.5);

  return {
    score,
    source: 'rules',
    confidence: Number(confidence.toFixed(2)),
    category: guessCategory(padded),
    hits
  };
}

// Confidence bands from the data-flow spec: scores comfortably below 25 or
// above 75 (with adequate confidence) are used immediately; everything else is
// ambiguous and worth escalating to tier 2/3.
export function isConfident(verdict) {
  return (verdict.score <= 25 || verdict.score >= 75) && verdict.confidence >= 0.75;
}
