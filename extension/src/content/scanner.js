// Scanner: find headline-like elements for a site config and keep up with
// infinite feeds via a MutationObserver. Candidates are debounced before being
// handed off so a burst of DOM changes turns into one batch, not hundreds.

const MIN_TEXT_LENGTH = 8;

/**
 * Collect fresh candidate elements under a root for a given config. Pure enough
 * to unit test: pass a `seen` set to make it idempotent across calls.
 * @param {ParentNode} root
 * @param {object} config selector config with container, headline
 * @param {WeakSet} seen elements already processed
 * @returns {{el:Element, headEl:Element, text:string}[]}
 */
export function collectCandidates(root, config, seen) {
  const out = [];
  const containers = new Set();

  // Include the root itself when it matches (added subtrees from the observer).
  if (root.matches && config.container && root.matches(config.container)) containers.add(root);
  if (root.querySelectorAll && config.container) {
    for (const el of root.querySelectorAll(config.container)) containers.add(el);
  }

  for (const el of containers) {
    if (seen.has(el)) continue;
    const headEl = config.headline ? el.querySelector(config.headline) : el;
    const text = ((headEl && headEl.textContent) || '').replace(/\s+/g, ' ').trim();
    seen.add(el);
    if (text.length < MIN_TEXT_LENGTH || !/[a-z]/i.test(text)) continue;
    out.push({ el, headEl: headEl || el, text });
  }
  return out;
}

export class Scanner {
  /**
   * @param {object} config selector config
   * @param {{ onBatch:(cands:object[])=>void, debounceMs?:number, doc?:Document }} opts
   */
  constructor(config, { onBatch, debounceMs = 400, doc = globalThis.document } = {}) {
    this.config = config;
    this.onBatch = onBatch;
    this.debounceMs = debounceMs;
    this.doc = doc;
    this.seen = new WeakSet();
    this.pending = [];
    this.timer = null;
    this.observer = null;
    this.lastScanMs = 0;
  }

  start() {
    this.scan(this.doc);
    this.observer = new MutationObserver((mutations) => this.onMutations(mutations));
    this.observer.observe(this.doc.body || this.doc, { childList: true, subtree: true });
  }

  stop() {
    if (this.observer) this.observer.disconnect();
    if (this.timer) clearTimeout(this.timer);
  }

  onMutations(mutations) {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) this.scan(node);
      }
    }
  }

  // Scan a root, queue any new candidates and schedule a flush. A performance
  // marker is recorded so Phase 5 can assert the per-batch budget.
  scan(root) {
    const start = perfNow();
    const found = collectCandidates(root, this.config, this.seen);
    this.lastScanMs = perfNow() - start;
    if (found.length) {
      this.pending.push(...found);
      this.schedule();
    }
  }

  schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const batch = this.pending;
      this.pending = [];
      if (batch.length) this.onBatch(batch);
    }, this.debounceMs);
  }
}

function perfNow() {
  return (globalThis.performance && globalThis.performance.now())
    ? globalThis.performance.now()
    : 0;
}
