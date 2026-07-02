import { describe, it, expect, vi } from 'vitest';
import { handleClassify } from '../api/classify.js';
import { memoryKV } from '../lib/kv.js';

const env = { API_KEY: 'secret', DAILY_CAP_USD: '0.50', RATE_LIMIT: '60' };
const auth = { 'x-hemisphere-key': 'secret' };

function fakeLLM(scores) {
  return vi.fn(async (items) => ({
    verdicts: items.map((it, i) => ({ hash: it.hash, score: scores[i] ?? 50, category: 'politics' })),
    usage: { input_tokens: 100, output_tokens: 20 }
  }));
}

describe('handleClassify', () => {
  it('rejects a missing or wrong key with 401', async () => {
    const r = await handleClassify({ method: 'POST', headers: {}, body: { items: [] }, env, kv: memoryKV() });
    expect(r.status).toBe(401);
  });

  it('rejects non-POST with 405', async () => {
    const r = await handleClassify({ method: 'GET', headers: auth, env, kv: memoryKV() });
    expect(r.status).toBe(405);
  });

  it('classifies a batch of misses via the LLM and caches them', async () => {
    const kv = memoryKV();
    const llm = fakeLLM([90, 5, 80]);
    const items = [
      { hash: 'a', text: 'Congress votes today' },
      { hash: 'b', text: 'Village fete raises funds' },
      { hash: 'c', text: 'NFL playoff picture' }
    ];
    const r = await handleClassify({ method: 'POST', headers: auth, body: { items }, env, kv, llm });
    expect(r.status).toBe(200);
    expect(r.json.degraded).toBe(false);
    expect(r.json.verdicts.map((v) => v.score)).toEqual([90, 5, 80]);
    expect(r.json.verdicts.every((v) => v.source === 'llm')).toBe(true);
  });

  it('serves a repeat call entirely from KV without calling the LLM again', async () => {
    const kv = memoryKV();
    const llm = fakeLLM([90]);
    const items = [{ hash: 'a', text: 'Congress votes today' }];
    await handleClassify({ method: 'POST', headers: auth, body: { items }, env, kv, llm });
    llm.mockClear();
    const r2 = await handleClassify({ method: 'POST', headers: auth, body: { items }, env, kv, llm });
    expect(llm).not.toHaveBeenCalled();
    expect(r2.json.verdicts[0].source).toBe('cache');
    expect(r2.json.verdicts[0].score).toBe(90);
  });

  it('degrades to cache-only once the daily cap is exceeded', async () => {
    const kv = memoryKV();
    await kv.set(`spend:${new Date(0).toISOString().slice(0, 10)}`, 1.0); // already over 0.50
    const llm = fakeLLM([90]);
    const r = await handleClassify({
      method: 'POST', headers: auth,
      body: { items: [{ hash: 'z', text: 'Senate hearing' }] },
      env, kv, llm, now: () => 0
    });
    expect(r.json.degraded).toBe(true);
    expect(llm).not.toHaveBeenCalled();
    expect(r.json.verdicts).toHaveLength(0);
  });

  it('rate limits beyond the per-minute cap with 429', async () => {
    const kv = memoryKV();
    const smallEnv = { ...env, RATE_LIMIT: '2' };
    const call = () => handleClassify({
      method: 'POST', headers: auth, body: { items: [] }, env: smallEnv, kv, now: () => 0
    });
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(429);
  });
});
