// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { collectCandidates } from '../src/content/scanner.js';
import { RemoteClassifier } from '../src/classify/remote.js';

describe('performance budget', () => {
  // The real 15 ms per-batch budget is enforced in a live browser via the
  // Scanner's lastScanMs marker (it logs when a scan exceeds budgetMs). jsdom
  // is an order of magnitude slower than a real DOM, so here we only guard
  // against accidental super-linear behaviour: doubling the feed must not more
  // than roughly double the work.
  const cfg = { container: '.card', headline: 'h3' };
  const feed = (n) => Array.from({ length: n },
    (_, i) => `<div class="card"><h3>Headline number ${i} about something</h3></div>`).join('');

  function timeScan(n) {
    document.body.innerHTML = feed(n);
    const start = performance.now();
    const found = collectCandidates(document, cfg, new WeakSet());
    return { ms: performance.now() - start, count: found.length };
  }

  it('extracts every headline exactly once', () => {
    const { count } = timeScan(600);
    expect(count).toBe(600);
  });

  it('scales roughly linearly with feed size', () => {
    const small = timeScan(200).ms + 0.001;
    const large = timeScan(800).ms + 0.001;
    // 4x the input should be well under 8x the time if the scan is linear.
    expect(large / small).toBeLessThan(8);
  });
});

describe('privacy: only normalised headline text leaves the machine', () => {
  it('sends nothing but hash and text to the API, never URLs or page content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ verdicts: [], degraded: false })
    });
    const remote = new RemoteClassifier({ apiBase: 'https://x.vercel.app', apiKey: 'k', fetchImpl });
    await remote.classify([{ hash: 'h1', text: 'A headline', url: 'https://leak.example/secret' }]);

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(Object.keys(body)).toEqual(['items']);
    expect(Object.keys(body.items[0]).sort()).toEqual(['hash', 'text']);
    expect(JSON.stringify(body)).not.toContain('leak.example');
  });
});
