# Phase 3 review: Cloud classifier

**Document owner:** Quentin Casares

## Scope delivered

- `api/lib/kv.js`: dependency-free KV with two backends, an in-memory store (tests, local) and an Upstash/Vercel KV REST client, selected by environment. Supports get, set with TTL, incr and expire.
- `api/lib/llm.js`: Anthropic Messages API client reading the model from `LLM_MODEL` (never hard-coded), temperature 0, a strict system prompt asking for a bare JSON array of `{hash, score, category}`, a tolerant parser, and a token-based cost estimator with env-overridable rates.
- `api/lib/http.js`: CORS headers and a Vercel adapter so each endpoint has a pure, testable core.
- `api/api/classify.js`: POST batch (max 20), shared-secret auth returning 401 otherwise, fixed-window rate limit of 60 per minute per key returning 429, KV verdict cache, LLM only for true misses, and a hard daily cost cap that flips the response to `degraded:true` (cache and rules only) when exceeded or when the LLM fails.
- `api/api/selectors.js`: GET authoritative selector configs, KV override preferred over the shipped seed.
- Extension side: `remote.js` batches to 20 with the shared secret and handles 401, non-ok and degraded responses silently; the 400 ms debounce lives in the scanner.
- Deploy scaffolding: `api/package.json` (zero runtime dependencies, all via fetch), `api/vercel.json`, `api/.env.example`.

## Verification

- `npm test` green: 44 tests. New coverage: KV TTL and incr; LLM parsing, clamping, cost and request shape; classify auth, batch classification, cache-only repeat (LLM not called again), cost-cap degradation, and rate limiting; selectors auth, seed and override.
- Contract: every tier returns `{hash, score, source, confidence}`; the API adds `category` for the allowlist and `degraded` at the envelope level.

## Locked-decision check

- Remote LLM only for ambiguous misses: rules and cache resolve first in the extension; the API calls the LLM only for hashes absent from KV. Pass.
- Hard daily cost cap: enforced in KV against a UTC day stamp; degraded mode returns cache and rules only. Pass.
- Abuse protection: shared secret required, 401 otherwise; 60 per minute per key. Pass.
- Only normalised headline text leaves the machine: the request body carries `{hash, text}` where text is the headline only; no URLs, no page content. Pass. (Full privacy sweep in Phase 5.)

## Gaps carried forward

- Per-site overrides UI and category allowlist adjustment tests are Phase 4 (the adjustment code exists and is wired; unit tests pending).
- A live end-to-end deploy to Vercel with a real KV store and model is a manual owner step, documented in `.env.example`.
