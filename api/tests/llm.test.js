import { describe, it, expect, vi } from 'vitest';
import { parseScores, estimateCostUsd, classifyWithLLM, SYSTEM_PROMPT } from '../lib/llm.js';

describe('parseScores', () => {
  it('parses a clean JSON array', () => {
    expect(parseScores('[{"hash":"x","score":80,"category":"politics"}]'))
      .toEqual([{ hash: 'x', score: 80, category: 'politics' }]);
  });

  it('tolerates surrounding prose or a code fence', () => {
    const text = 'Here you go:\n```json\n[{"hash":"y","score":10}]\n```';
    expect(parseScores(text)).toEqual([{ hash: 'y', score: 10, category: null }]);
  });

  it('clamps scores into 0..100 and rounds', () => {
    expect(parseScores('[{"hash":"a","score":140},{"hash":"b","score":-5},{"hash":"c","score":33.6}]'))
      .toEqual([
        { hash: 'a', score: 100, category: null },
        { hash: 'b', score: 0, category: null },
        { hash: 'c', score: 34, category: null }
      ]);
  });
});

describe('estimateCostUsd', () => {
  it('uses token usage when present', () => {
    const cost = estimateCostUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 }, {
      LLM_INPUT_COST_PER_MTOK: '1', LLM_OUTPUT_COST_PER_MTOK: '2'
    });
    expect(cost).toBeCloseTo(3, 5);
  });

  it('falls back to a per-item estimate without usage', () => {
    expect(estimateCostUsd({}, {}, 10)).toBeGreaterThan(0);
  });
});

describe('classifyWithLLM', () => {
  it('posts to Anthropic with the env model and temperature 0', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '[{"hash":"h1","score":90,"category":"politics"}]' }],
        usage: { input_tokens: 100, output_tokens: 20 }
      })
    });
    const env = { LLM_MODEL: 'test-model', ANTHROPIC_API_KEY: 'sk-test' };
    const out = await classifyWithLLM([{ hash: 'h1', text: 'Congress votes' }], { env, fetchImpl });

    expect(out.verdicts).toEqual([{ hash: 'h1', score: 90, category: 'politics' }]);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.model).toBe('test-model');
    expect(body.temperature).toBe(0);
    expect(body.system).toBe(SYSTEM_PROMPT);
  });

  it('throws when the model env var is missing', async () => {
    await expect(classifyWithLLM([], { env: { ANTHROPIC_API_KEY: 'x' } })).rejects.toThrow('LLM_MODEL');
  });
});
