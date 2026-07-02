// GET /api/selectors
//
// Returns the authoritative site selector configs so the extension can repair
// selector breakage without a new release. Any configs written to KV under
// "selectors" override the shipped seed, letting the owner hot-fix a site.
//
// Returns: { version, configs: [...] }

import { createKV } from '../lib/kv.js';
import { adapt, headerGet } from '../lib/http.js';
import seed from '../data/selectors.json' with { type: 'json' };

export async function handleSelectors({ method, headers, env = process.env, kv = createKV(env) }) {
  if (method !== 'GET') return { status: 405, json: { error: 'method_not_allowed' } };

  const key = headerGet(headers, 'x-hemisphere-key');
  if (!env.API_KEY || key !== env.API_KEY) return { status: 401, json: { error: 'unauthorized' } };

  const override = await kv.get('selectors');
  if (override && Array.isArray(override.configs)) {
    return { status: 200, json: override };
  }
  return { status: 200, json: seed };
}

export default adapt(handleSelectors);
