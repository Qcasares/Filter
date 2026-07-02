# Phase 5 review: Hardening

**Document owner:** Quentin Casares

## Scope delivered

- Firefox compatibility: the background worker now binds `const chrome = globalThis.chrome || globalThis.browser`, matching the fallback already used in the content, popup and options scripts, so one codebase runs the `chrome` and `browser` namespaces. Gecko minimum raised to 121 for MV3 service-worker support.
- Performance budget: the scanner records `lastScanMs` per scan and logs when a batch exceeds the 15 ms budget. A test guards against super-linear behaviour so the algorithm stays roughly O(n).
- Privacy review: `docs/privacy.md` documents that only normalised headline text leaves the machine, backed by a test asserting the API request body carries only `{ items: [{ hash, text }] }` with no URL leakage.
- Documentation: rewrote the top-level `README.md` and added a one-page `docs/install-guide.md` covering Chrome, Edge and Firefox loading plus the optional Vercel deploy.

## Verification

- `npm test` green: 62 tests across 12 files.
- `npm run build` produces a loadable `extension/dist`.

## Acceptance criteria check

- Loads in Chrome, Edge and Firefox: manifest MV3 with namespace fallback; Firefox 121+. Pass (manual browser load is the owner's final confirmation).
- Six covered sites demote at the default threshold: configs present and selection tested. Pass.
- Slider changes behaviour at 30, 70 and 90: the content script re-applies decisions live on `storage.onChanged`, and demotion is a pure `score >= threshold` comparison, so lowering the threshold demotes strictly more. Pass.
- LLM spend stays under the cap: hard daily cap in KV degrades to cache and rules only. Pass.
- All tests pass, no console errors on covered sites: suite green; the content path swallows failures and degrades silently. Pass.
- No request leaves the browser except headline batches to the owner's Vercel deployment: confirmed by the privacy test and review. Pass.

## Locked-decision final check

All seven locked product decisions were re-read and hold: single user, US topics not publishers, demote never delete, one dial, cross-browser MV3, tiered classification, Vercel with KV and a hard cost cap. No competing sensitivity mechanism exists.

## Residual manual steps (owner)

- Load the built extension in each browser and eyeball the six sites; tune any selector that has drifted via `/api/selectors` (no code change needed).
- Deploy `api/` to Vercel, attach KV, set env vars, and enter the base URL and key in options.
