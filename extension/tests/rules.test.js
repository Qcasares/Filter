import { describe, it, expect } from 'vitest';
import { normalise, scoreHeadline, isConfident, regionForHost } from '../src/classify/rules.js';

describe('normalise', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normalise('  Biden: "Congress" WILL   act! ')).toBe('biden congress will act');
  });

  it('handles null and undefined without throwing', () => {
    expect(normalise(null)).toBe('');
    expect(normalise(undefined)).toBe('');
  });
});

describe('scoreHeadline', () => {
  it('scores a strong US-politics headline highly', () => {
    const v = scoreHeadline('President addresses Congress on the economy');
    expect(v.score).toBeGreaterThanOrEqual(75);
    expect(v.source).toBe('rules');
    expect(isConfident(v)).toBe(true);
  });

  it('scores a plainly non-US headline at zero', () => {
    const v = scoreHeadline('Local bakery wins regional award');
    expect(v.score).toBe(0);
    expect(isConfident(v)).toBe(true);
  });

  it('catches a US topic even on a UK publisher (topic not publisher)', () => {
    const v = scoreHeadline('Trump rallies supporters ahead of the election', { host: 'bbc.co.uk' });
    expect(v.score).toBeGreaterThanOrEqual(50);
  });

  it('does not demote a UK story merely because it sits on a US site', () => {
    const v = scoreHeadline('Westminster debates NHS funding in Parliament', { host: 'cnn.com' });
    expect(v.score).toBeLessThanOrEqual(25);
  });

  it('lowers confidence when US and counter signals conflict', () => {
    const v = scoreHeadline('UK reacts to US Congress vote on trade deal');
    expect(v.confidence).toBeLessThanOrEqual(0.5);
  });

  it('boosts US state names only in a political context', () => {
    const plain = scoreHeadline('Georgia mountains draw autumn hikers');
    const political = scoreHeadline('Georgia election recount enters second day');
    expect(political.score).toBeGreaterThan(plain.score);
  });

  it('recognises US sports leagues', () => {
    const v = scoreHeadline('NFL playoff picture takes shape after Sunday games');
    expect(v.score).toBeGreaterThanOrEqual(40);
    expect(v.category).toBe('sport');
  });
});

describe('regionForHost', () => {
  it('maps known domains and subdomains', () => {
    expect(regionForHost('www.bbc.co.uk')).toBe('uk');
    expect(regionForHost('edition.cnn.com')).toBe('us');
    expect(regionForHost('unknown.example')).toBe(null);
  });
});
