// Vercel KV access, kept dependency-free and testable.
//
// In production this talks to Vercel KV (Upstash Redis) over its REST API using
// the KV_REST_API_URL and KV_REST_API_TOKEN environment variables. In tests, or
// when those are absent, it falls back to an in-memory store with the same
// semantics so the classifier logic can be exercised without a network.

// In-memory backend. TTLs are honoured against an injectable clock.
export function memoryKV({ now = () => Date.now() } = {}) {
  const store = new Map(); // key -> { value, expires }

  function live(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expires && entry.expires < now()) { store.delete(key); return null; }
    return entry;
  }

  return {
    async get(key) {
      const entry = live(key);
      return entry ? entry.value : null;
    },
    async set(key, value, { ttlSeconds } = {}) {
      store.set(key, { value, expires: ttlSeconds ? now() + ttlSeconds * 1000 : 0 });
    },
    async incr(key) {
      const entry = live(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      store.set(key, { value: next, expires: entry ? entry.expires : 0 });
      return next;
    },
    async incrByFloat(key, amount) {
      const entry = live(key);
      const next = (entry ? Number(entry.value) : 0) + Number(amount);
      store.set(key, { value: next, expires: entry ? entry.expires : 0 });
      return next;
    },
    async expire(key, ttlSeconds) {
      const entry = live(key);
      if (entry) entry.expires = now() + ttlSeconds * 1000;
    }
  };
}

// Upstash/Vercel KV REST backend. Commands are sent as a JSON array body, e.g.
// ["SET", key, value, "EX", "60"], and the response is { result }.
export function restKV({ url, token, fetchImpl = fetch }) {
  const base = url.replace(/\/$/, '');
  async function command(args) {
    const res = await fetchImpl(base, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args.map(String))
    });
    if (!res.ok) throw new Error(`KV command failed: ${res.status}`);
    const data = await res.json();
    // Upstash can return 200 with an error field (bad command, quota, etc.).
    // Surface it rather than silently treating it as a miss or a no-op.
    if (data.error) throw new Error(`KV command error: ${data.error}`);
    return data.result;
  }
  return {
    async get(key) {
      const raw = await command(['GET', key]);
      if (raw == null) return null;
      try { return JSON.parse(raw); } catch { return raw; }
    },
    async set(key, value, { ttlSeconds } = {}) {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      const args = ['SET', key, payload];
      if (ttlSeconds) args.push('EX', ttlSeconds);
      await command(args);
    },
    async incr(key) {
      return Number(await command(['INCR', key]));
    },
    async incrByFloat(key, amount) {
      return Number(await command(['INCRBYFLOAT', key, amount]));
    },
    async expire(key, ttlSeconds) {
      await command(['EXPIRE', key, ttlSeconds]);
    }
  };
}

export function createKV(env = process.env) {
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return restKV({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });
  }
  return memoryKV();
}
