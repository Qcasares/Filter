// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { demote, undemote, isRevealed } from '../src/content/demote.js';

beforeEach(() => {
  document.body.innerHTML = '';
  try { sessionStorage.clear(); } catch { /* ignore */ }
});

describe('demote', () => {
  it('hides the element and injects a shadow-DOM reveal bar', () => {
    document.body.innerHTML = '<article id="a">A US politics headline</article>';
    const el = document.getElementById('a');
    const host = demote(el, 'hash-a');
    expect(el.style.display).toBe('none');
    expect(el.dataset.hemiDemoted).toBe('1');
    expect(host.shadowRoot).toBeTruthy();
    expect(host.shadowRoot.querySelector('.bar').textContent).toBe('US story hidden · tap to reveal');
  });

  it('is idempotent', () => {
    document.body.innerHTML = '<article id="a">Headline text here</article>';
    const el = document.getElementById('a');
    demote(el, 'hash-a');
    const second = demote(el, 'hash-a');
    expect(second).toBe(null);
    expect(document.querySelectorAll('.hemi-bar-host')).toHaveLength(1);
  });

  it('restores the original element and remembers the reveal on click', () => {
    document.body.innerHTML = '<article id="a" style="display:flex">Headline text here</article>';
    const el = document.getElementById('a');
    const host = demote(el, 'hash-a');
    host.shadowRoot.querySelector('.bar').click();
    expect(el.style.display).toBe('flex'); // original inline display restored
    expect(el.dataset.hemiDemoted).toBeUndefined();
    expect(document.querySelectorAll('.hemi-bar-host')).toHaveLength(0);
    expect(isRevealed('hash-a')).toBe(true);
  });

  it('undemote restores silently without marking a reveal', () => {
    document.body.innerHTML = '<article id="b">Another headline here</article>';
    const el = document.getElementById('b');
    demote(el, 'hash-b');
    undemote(el);
    expect(el.style.display).toBe('');
    expect(isRevealed('hash-b')).toBe(false);
    expect(document.querySelectorAll('.hemi-bar-host')).toHaveLength(0);
  });
});
