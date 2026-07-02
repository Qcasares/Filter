// POST /api/classify
//
// Body: { items: [{ hash, text }, ...] } (max 20).
// Returns: { verdicts: [{ hash, score, source, confidence, category }], degraded }
//
// Pipeline: authenticate, rate limit, serve KV cache hits, then call the LLM
// only for true misses, subject to a hard daily cost cap. When the cap is hit
// or the LLM fails, the endpoint returns whatever it has and sets degraded:true;
// the extension handles that silently by keeping its local rules scores.

import { createKV } from '../lib/kv.js';
import { classifyWithLLM, estimateCostUsd } from '../lib/llm.js';
import { adapt, headerGet } from '../lib/http.js';

const VERDICT_TTL_SECONDS = 60 * 60 * 24 * 14; // fourteen days
const MAX_ITEMS = 20;

function dayStamp(ms) {
  return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

export async function handleClassify({
  method,
  headers,
  body,
  env = process.env,
  kv = createKV(env),
  llm = classifyWithLLM,
  now = () => Date.now()
}) {
  if (method !== 'POST') return { status: 405, json: { error: 'method_not_allowed' } };

  const key = headerGet(headers, 'x-hemisphere-key');
  if (!env.API_KEY || key !== env.API_KEY) return { status: 401, json: { error: 'unauthorized' } };

  // Fixed-window rate limit, per key, per minute.
  const limit = Number(env.RATE_LIMIT || 60);
  const rlKey = `rl:${key}:${Math.floor(now() / 60000)}`;
  const count = await kv.incr(rlKey);
  if (count === 1) await kv.expire(rlKey, 60);
  if (count > limit) return { status: 429, json: { error: 'rate_limited' } };

  const items = (Array.isArray(body?.items) ? body.items : [])
    .filter((it) => it && typeof it.hash === 'string' && typeof it.text === 'string')
    .slice(0, MAX_ITEMS);

  const verdicts = [];
  const misses = [];

  // Tier: KV verdict cache.
  for (const it of items) {
    const cached = await kv.get(`v:${it.hash}`);
    if (cached) {
      verdicts.push({
        hash: it.hash,
        score: cached.score,
        source: 'cache',
        confidence: cached.confidence ?? 0.9,
        category: cached.category ?? null
      });
    } else {
      misses.push(it);
    }
  }

  // Cost cap check.
  const cap = Number(env.DAILY_CAP_USD || 0.5);
  const spendKey = `spend:${dayStamp(now())}`;
  const spent = Number((await kv.get(spendKey)) || 0);

  let degraded = false;
  if (misses.length && spent >= cap) {
    degraded = true; // over budget: cache and rules only
  } else if (misses.length) {
    try {
      const { verdicts: llmVerdicts, usage } = await llm(misses, { env });
      const cost = estimateCostUsd(usage, env, misses.length);
      // Atomic increment so concurrent requests cannot clobber each other's
      // spend and slip past the cap. Set the day's expiry on first write.
      const total = await kv.incrByFloat(spendKey, cost);
      if (total === cost) await kv.expire(spendKey, 60 * 60 * 26);

      const byHash = new Map(llmVerdicts.map((v) => [v.hash, v]));
      for (const it of misses) {
        const v = byHash.get(it.hash);
        if (!v) continue;
        const record = { score: v.score, confidence: 0.85, category: v.category || null };
        await kv.set(`v:${it.hash}`, record, { ttlSeconds: VERDICT_TTL_SECONDS });
        verdicts.push({ hash: it.hash, source: 'llm', ...record });
      }
    } catch {
      degraded = true; // LLM failure: degrade silently
    }
  }

  return { status: 200, json: { verdicts, degraded } };
}

export default adapt(handleClassify);
