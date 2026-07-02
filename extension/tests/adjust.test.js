import { describe, it, expect } from 'vitest';
import { applyAllowlist, ALLOWLIST_ADJUSTMENT } from '../src/classify/adjust.js';

describe('applyAllowlist', () => {
  it('pulls down the score of an allowlisted category', () => {
    const v = { hash: 'x', score: 85, category: 'technology', source: 'llm' };
    const out = applyAllowlist(v, ['technology']);
    expect(out.score).toBe(85 - ALLOWLIST_ADJUSTMENT);
    expect(out.adjusted).toBe(true);
  });

  it('keeps an allowlisted US-tech story below a default threshold of 70', () => {
    const v = { hash: 'x', score: 90, category: 'technology' };
    expect(applyAllowlist(v, ['technology']).score).toBeLessThan(70);
  });

  it('leaves non-allowlisted categories untouched', () => {
    const v = { hash: 'x', score: 90, category: 'politics' };
    const out = applyAllowlist(v, ['technology']);
    expect(out.score).toBe(90);
    expect(out.adjusted).toBeUndefined();
  });

  it('is a no-op when the verdict has no category', () => {
    const v = { hash: 'x', score: 90, category: null };
    expect(applyAllowlist(v, ['technology'])).toEqual(v);
  });

  it('clamps the adjusted score at zero', () => {
    const v = { hash: 'x', score: 30, category: 'sport' };
    expect(applyAllowlist(v, ['sport']).score).toBe(0);
  });
});
