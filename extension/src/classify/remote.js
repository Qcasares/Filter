// Tier 3 client: batched calls to the owner's Vercel API.
//
// This module owns the network side of classification: chunking to at most 20
// headlines per request, attaching the shared secret, and handling degraded
// mode silently. The 400 ms debounce that feeds it lives in the scanner, which
// is where candidates actually stream in.

const MAX_BATCH = 20;

export class RemoteClassifier {
  constructor({ apiBase, apiKey, fetchImpl = globalThis.fetch } = {}) {
    this.apiBase = (apiBase || '').replace(/\/$/, '');
    this.apiKey = apiKey || '';
    this.fetchImpl = fetchImpl;
    this.degraded = false;
  }

  get configured() {
    return Boolean(this.apiBase && this.apiKey);
  }

  // Classify a list of { hash, text } items. Returns a Map of hash -> verdict.
  // On any failure (no config, network error, auth error, degraded server) the
  // returned map simply omits the unresolved hashes; callers keep their local
  // rules score for those. Hemisphere never blocks the page on the network.
  async classify(items) {
    const out = new Map();
    if (!this.configured || items.length === 0) return out;

    for (let i = 0; i < items.length; i += MAX_BATCH) {
      const batch = items.slice(i, i + MAX_BATCH);
      try {
        const res = await this.fetchImpl(`${this.apiBase}/api/classify`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-hemisphere-key': this.apiKey
          },
          body: JSON.stringify({
            items: batch.map((it) => ({ hash: it.hash, text: it.text }))
          })
        });

        if (res.status === 401) {
          // Bad or missing key: stop trying this round, keep rules verdicts.
          this.degraded = true;
          break;
        }
        if (!res.ok) continue;

        const data = await res.json();
        this.degraded = Boolean(data.degraded);
        for (const v of data.verdicts || []) {
          out.set(v.hash, {
            hash: v.hash,
            score: v.score,
            source: v.source || 'llm',
            confidence: typeof v.confidence === 'number' ? v.confidence : 0.8,
            category: v.category || null
          });
        }
      } catch {
        // Network failure: leave these to the local rules score. Silent.
        continue;
      }
    }
    return out;
  }
}
