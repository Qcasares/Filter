import { describe, it, expect } from 'vitest';
import { handleSelectors } from '../api/selectors.js';
import { memoryKV } from '../lib/kv.js';

const env = { API_KEY: 'secret' };
const auth = { 'x-hemisphere-key': 'secret' };

describe('handleSelectors', () => {
  it('requires the shared key', async () => {
    const r = await handleSelectors({ method: 'GET', headers: {}, env, kv: memoryKV() });
    expect(r.status).toBe(401);
  });

  it('returns the shipped seed configs by default', async () => {
    const r = await handleSelectors({ method: 'GET', headers: auth, env, kv: memoryKV() });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.configs)).toBe(true);
    expect(r.json.configs.find((c) => c.id === 'bbc')).toBeTruthy();
  });

  it('prefers a KV override when present', async () => {
    const kv = memoryKV();
    await kv.set('selectors', { version: 2, configs: [{ id: 'bbc', version: 2, match: ['bbc.com'] }] });
    const r = await handleSelectors({ method: 'GET', headers: auth, env, kv });
    expect(r.json.version).toBe(2);
    expect(r.json.configs).toHaveLength(1);
  });
});
