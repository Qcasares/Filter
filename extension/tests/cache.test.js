import { describe, it, expect } from 'vitest';
import { hashHeadline, createCache, memoryStorage } from '../src/classify/cache.js';

describe('hashHeadline', () => {
  it('produces a stable 64-char sha256 hex digest', async () => {
    const h = await hashHeadline('President addresses Congress');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('collapses to the same hash for equivalent headlines after normalisation', async () => {
    const a = await hashHeadline('President addresses Congress');
    const b = await hashHeadline('  President   addresses, "Congress"! ');
    expect(a).toBe(b);
  });

  it('produces different hashes for different headlines', async () => {
    const a = await hashHeadline('Congress votes today');
    const b = await hashHeadline('Parliament votes today');
    expect(a).not.toBe(b);
  });
});

describe('createCache', () => {
  it('returns null on a miss and the stored verdict on a hit', async () => {
    const cache = createCache({ storage: memoryStorage() });
    const hash = await hashHeadline('a headline');
    expect(await cache.get(hash)).toBe(null);
    await cache.set({ hash, score: 82, confidence: 0.9 });
    const hit = await cache.get(hash);
    expect(hit).toEqual({ hash, score: 82, source: 'cache', confidence: 0.9 });
  });

  it('never persists headline text, only hash-keyed scores', async () => {
    const storage = memoryStorage();
    const cache = createCache({ storage });
    const hash = await hashHeadline('secret words here');
    await cache.set({ hash, score: 50, confidence: 0.5 });
    const dump = JSON.stringify(await storage.get('hemi:v:' + hash));
    expect(dump).not.toContain('secret');
  });

  it('treats expired entries as a miss and evicts them', async () => {
    let clock = 1000;
    const cache = createCache({ storage: memoryStorage(), ttlMs: 100, now: () => clock });
    const hash = await hashHeadline('perishable');
    await cache.set({ hash, score: 10, confidence: 0.9 });
    clock = 1050;
    expect(await cache.get(hash)).not.toBe(null);
    clock = 2000;
    expect(await cache.get(hash)).toBe(null);
  });
});
