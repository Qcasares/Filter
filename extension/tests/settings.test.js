import { describe, it, expect } from 'vitest';
import { effectiveFor, DEFAULT_SETTINGS } from '../src/settings.js';

describe('effectiveFor', () => {
  const base = { ...DEFAULT_SETTINGS, enabled: true, threshold: 70 };

  it('uses the global threshold when there is no override', () => {
    expect(effectiveFor(base, 'bbc.co.uk')).toEqual({ enabled: true, threshold: 70 });
  });

  it('applies a per-site threshold override', () => {
    const s = { ...base, perSite: { 'bbc.co.uk': { threshold: 40 } } };
    expect(effectiveFor(s, 'bbc.co.uk').threshold).toBe(40);
  });

  it('lets a per-site toggle disable a single site', () => {
    const s = { ...base, perSite: { 'reddit.com': { enabled: false } } };
    expect(effectiveFor(s, 'reddit.com').enabled).toBe(false);
    expect(effectiveFor(s, 'bbc.co.uk').enabled).toBe(true);
  });

  it('global disable overrides any per-site enable', () => {
    const s = { ...base, enabled: false, perSite: { 'bbc.co.uk': { enabled: true } } };
    expect(effectiveFor(s, 'bbc.co.uk').enabled).toBe(false);
  });
});
