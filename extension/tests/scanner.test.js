// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { collectCandidates, Scanner } from '../src/content/scanner.js';

const config = { container: '.card', headline: 'h3' };

describe('collectCandidates', () => {
  it('extracts headline text from containers', () => {
    document.body.innerHTML = `
      <div class="card"><h3>President addresses Congress</h3></div>
      <div class="card"><h3>Local bakery award</h3></div>
    `;
    const found = collectCandidates(document, config, new WeakSet());
    expect(found.map((c) => c.text)).toEqual([
      'President addresses Congress',
      'Local bakery award'
    ]);
  });

  it('skips empty or too-short headlines', () => {
    document.body.innerHTML = `<div class="card"><h3>  </h3></div><div class="card"><h3>hi</h3></div>`;
    expect(collectCandidates(document, config, new WeakSet())).toHaveLength(0);
  });

  it('does not re-emit already-seen containers', () => {
    document.body.innerHTML = `<div class="card"><h3>A real headline here</h3></div>`;
    const seen = new WeakSet();
    expect(collectCandidates(document, config, seen)).toHaveLength(1);
    expect(collectCandidates(document, config, seen)).toHaveLength(0);
  });

  it('re-scans a container that was empty and populated asynchronously', () => {
    document.body.innerHTML = `<div class="card"><h3>Loading</h3></div>`;
    const seen = new WeakSet();
    // First pass: placeholder is too short, so it must not be marked seen.
    expect(collectCandidates(document, config, seen)).toHaveLength(0);
    // Content arrives later; the same container is now emitted.
    document.querySelector('h3').textContent = 'President addresses Congress';
    expect(collectCandidates(document, config, seen)).toHaveLength(1);
  });
});

describe('Scanner', () => {
  it('debounces an initial scan into a single batch', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div class="card"><h3>A genuine headline</h3></div>`;
    const onBatch = vi.fn();
    const scanner = new Scanner(config, { onBatch, debounceMs: 400 });
    scanner.start();
    expect(onBatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onBatch.mock.calls[0][0]).toHaveLength(1);
    scanner.stop();
    vi.useRealTimers();
  });

  it('picks up nodes added after start via the observer', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    const onBatch = vi.fn();
    const scanner = new Scanner(config, { onBatch, debounceMs: 400 });
    scanner.start();
    vi.advanceTimersByTime(400);
    onBatch.mockClear();

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h3>Breaking news headline</h3>';
    document.body.appendChild(card);
    // MutationObserver callbacks are microtasks; flush them.
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(400);
    expect(onBatch).toHaveBeenCalledTimes(1);
    scanner.stop();
    vi.useRealTimers();
  });
});
