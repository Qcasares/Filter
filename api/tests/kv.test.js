import { describe, it, expect } from 'vitest';
import { memoryKV } from '../lib/kv.js';

describe('memoryKV', () => {
  it('stores and returns values', async () => {
    const kv = memoryKV();
    await kv.set('a', { score: 80 });
    expect(await kv.get('a')).toEqual({ score: 80 });
    expect(await kv.get('missing')).toBe(null);
  });

  it('honours TTL against the injected clock', async () => {
    let clock = 0;
    const kv = memoryKV({ now: () => clock });
    await kv.set('a', 1, { ttlSeconds: 10 });
    clock = 9000;
    expect(await kv.get('a')).toBe(1);
    clock = 11000;
    expect(await kv.get('a')).toBe(null);
  });

  it('increments counters', async () => {
    const kv = memoryKV();
    expect(await kv.incr('c')).toBe(1);
    expect(await kv.incr('c')).toBe(2);
  });
});
