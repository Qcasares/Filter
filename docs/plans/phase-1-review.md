# Phase 1 review: Foundations

**Document owner:** Quentin Casares

## Scope delivered

- Repository scaffold: root `package.json` (type module), `vitest.config.js`, `.gitignore`, esbuild build script producing `extension/dist`.
- Manifest V3 with minimal permissions (`storage`, `activeTab`, `alarms`) and host permissions limited to the six covered sites. The API domain is reached from the service worker and relies on the API returning permissive CORS, so no broad host permission is needed.
- Seed data: `data/entities-us.json` (strong, medium and weak entities, US states and cities, political-context words, counter signals, and category keyword lists) and `data/publishers.json` (domain to region map used only as a weak prior).
- Tier 1 `rules.js`: normalisation, weighted scoring, region prior, political-context boost, category guess, and a confidence signal that drops when US and counter signals conflict.
- Tier 2 `cache.js`: SHA-256 hashing of the normalised headline, pluggable storage (chrome.storage.local in the browser, in-memory in tests), and TTL expiry. Only hash-keyed scores are stored, never headline text.
- Popup and options pages, both wired through `chrome.storage.sync` with a single threshold dial.

## Verification

- `npm test` green: 16 tests across rules and cache.
- `npm run build` produces a loadable unpacked extension with a working popup (`extension/dist/popup.html`).

## Locked-decision check

- Single user, no accounts: no auth or tenancy anywhere. Pass.
- Filter target is US topics not publishers: publisher region is a weak prior (plus or minus 8) that never decides a verdict; tests confirm a US topic on the BBC is caught and a UK topic on CNN is not. Pass.
- One dial: `threshold` is the only sensitivity control; the allowlist adjusts the score, it does not add a second dial. Pass.
- Tiered classification: rules first, cache second, remote third, all returning the same contract shape. Pass.

## Gaps carried forward

- Content scanner and demote UI are placeholders (Phase 2).
- Remote API server does not yet exist; `remote.js` degrades to rules-only when unconfigured (Phase 3).
- Site selectors are best-effort and will need real-world tuning; the remote selector-update endpoint (Phase 4) exists to fix them without republishing.

No gaps block Phase 2.
