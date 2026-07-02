// Tier 2: hashed verdict cache.
//
// Verdicts are keyed by the SHA-256 of the normalised headline so the same
// story seen on two sites shares one cache entry, and so that only opaque
// hashes (never readable text) are ever persisted. Storage is pluggable: the
// extension passes chrome.storage.local, tests pass an in-memory stub.

import { normalise } from './rules.js';

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 14; // fourteen days
const KEY_PREFIX = 'hemi:v:';

/**
 * SHA-256 hex digest of the normalised headline. This is the canonical cache
 * key and the `hash` field of the classification contract.
 * @param {string} headline
 * @returns {Promise<string>}
 */
export async function hashHeadline(headline) {
  const data = new TextEncoder().encode(normalise(headline));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// A minimal in-memory storage adapter matching the subset of the
// chrome.storage.local API that the cache needs. Used as a fallback and in
// tests so the cache logic can be exercised without a browser.
export function memoryStorage() {
  const store = new Map();
  return {
    async get(keys) {
      const out = {};
      for (const k of [].concat(keys)) if (store.has(k)) out[k] = store.get(k);
      return out;
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) store.set(k, v);
    },
    async remove(keys) {
      for (const k of [].concat(keys)) store.delete(k);
    }
  };
}

// Adapt the callback-or-promise chrome.storage.local API to always return a
// promise, so the cache can await it uniformly across Chrome and Firefox.
function wrapChromeStorage(area) {
  const call = (method, arg) =>
    new Promise((resolve, reject) => {
      try {
        const maybe = area[method](arg, (res) => {
          const err = globalThis.chrome?.runtime?.lastError;
          if (err) reject(new Error(err.message));
          else resolve(res);
        });
        // Firefox returns a promise directly.
        if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  return {
    get: (keys) => call('get', keys),
    set: (obj) => call('set', obj),
    remove: (keys) => call('remove', keys)
  };
}

// Detect the best available storage backend at construction time.
function detectStorage() {
  const area = globalThis.chrome?.storage?.local;
  return area ? wrapChromeStorage(area) : memoryStorage();
}

export function createCache({ storage = detectStorage(), ttlMs = DEFAULT_TTL_MS, now = () => Date.now() } = {}) {
  const keyFor = (hash) => KEY_PREFIX + hash;

  return {
    /**
     * Look up a cached verdict by headline hash. Expired entries are treated as
     * a miss and removed. Returns null on miss.
     */
    async get(hash) {
      const key = keyFor(hash);
      const res = await storage.get(key);
      const entry = res && res[key];
      if (!entry) return null;
      if (entry.expires && entry.expires < now()) {
        await storage.remove(key);
        return null;
      }
      return { hash, score: entry.score, source: 'cache', confidence: entry.confidence };
    },

    /**
     * Persist a verdict. The stored record keeps only the hash, score,
     * confidence and expiry: never the headline text itself.
     */
    async set(verdict) {
      const key = keyFor(verdict.hash);
      await storage.set({
        [key]: {
          score: verdict.score,
          confidence: verdict.confidence,
          expires: now() + ttlMs
        }
      });
      return verdict;
    },

    async remove(hash) {
      await storage.remove(keyFor(hash));
    }
  };
}
