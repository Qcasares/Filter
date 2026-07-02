// Small helpers shared by the serverless endpoints: CORS headers so the
// extension service worker can call the API cross-origin without a broad host
// permission, and an adapter that turns a pure core handler into a Vercel
// (req, res) function so the core stays trivially testable.

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-hemisphere-key',
  'access-control-max-age': '86400'
};

// Normalise header lookups to lowercase.
export function headerGet(headers, name) {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  if (typeof headers.get === 'function') return headers.get(lower) ?? headers.get(name);
  return headers[lower] ?? headers[name];
}

async function readBody(req) {
  if (req.body !== undefined) return req.body; // Vercel pre-parses JSON bodies
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return undefined;
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return undefined; }
}

/**
 * Wrap a core handler `({method, headers, body, env}) => {status, json}` into a
 * Vercel serverless function, adding CORS and preflight handling.
 */
export function adapt(core) {
  return async function handler(req, res) {
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    const body = req.method === 'POST' ? await readBody(req) : undefined;
    const result = await core({ method: req.method, headers: req.headers, body, env: process.env });
    res.status(result.status || 200);
    if (result.json !== undefined) res.json(result.json);
    else res.end();
  };
}
