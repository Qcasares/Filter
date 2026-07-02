// Anthropic Messages API client. The model is always read from LLM_MODEL and
// never hard-coded, so the owner can point at the cheapest current Haiku-class
// model. Temperature is 0 for stable scoring. The prompt asks for a bare JSON
// array of { hash, score } (and an optional category), nothing else.

export const SYSTEM_PROMPT = [
  'You score news headlines for US-topic relevance.',
  'US-topic relevance means the story is primarily about United States politics,',
  'society, sport or domestic affairs. A US election story on a British outlet is',
  'high; a UK story on a US outlet is low. Judge the topic, not the publisher.',
  '',
  'For each item you are given { hash, text }. Return ONLY a JSON array, one',
  'object per item, of the form { "hash": string, "score": number, "category": string }',
  'where score is an integer 0 to 100 and category is one of',
  '"politics", "sport", "technology", "society" or "other".',
  'Do not include any prose, explanation or markdown. Output the JSON array only.'
].join('\n');

function clampScore(n) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return 50;
  return Math.max(0, Math.min(100, v));
}

// Pull the first JSON array out of the model's text response, tolerating stray
// whitespace or an accidental code fence.
export function parseScores(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    return arr
      .filter((o) => o && typeof o.hash === 'string')
      .map((o) => ({ hash: o.hash, score: clampScore(o.score), category: o.category || null }));
  } catch {
    // Truncated or malformed model output: degrade to no verdicts rather than
    // throwing and failing the whole batch.
    return [];
  }
}

/**
 * Classify a batch of { hash, text } items with the LLM.
 * @returns {Promise<{verdicts:{hash,score,category}[], usage:object}>}
 */
export async function classifyWithLLM(items, { env = process.env, fetchImpl = fetch } = {}) {
  const model = env.LLM_MODEL;
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!model) throw new Error('LLM_MODEL is not set');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const userContent = JSON.stringify(items.map((it) => ({ hash: it.hash, text: it.text })));

  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('');
  return { verdicts: parseScores(text), usage: data.usage || {} };
}

// Rough spend estimate for the daily cost cap. Per-million-token rates default
// to Haiku-class pricing and are overridable via env so they can track changes
// without a code edit.
export function estimateCostUsd(usage, env = process.env, itemCount = 0) {
  const inRate = Number(env.LLM_INPUT_COST_PER_MTOK || 0.8);
  const outRate = Number(env.LLM_OUTPUT_COST_PER_MTOK || 4.0);
  const inTok = Number(usage?.input_tokens);
  const outTok = Number(usage?.output_tokens);
  if (!Number.isNaN(inTok) && !Number.isNaN(outTok)) {
    return (inTok / 1e6) * inRate + (outTok / 1e6) * outRate;
  }
  // Fall back to a per-item estimate when usage is missing.
  return itemCount * 0.00005;
}
