# Hemisphere

**Document owner:** Quentin Casares

Hemisphere is a personal browser extension, plus a lightweight cloud service, that demotes US-topic content across your browsing. Matched items collapse to a slim reveal bar rather than disappearing, so nothing breaks and nothing is hidden from you permanently.

This is a single-user tool. There are no accounts, no multi-tenancy and no billing.

## What it does

- Scores every candidate headline from 0 to 100 for US-topic relevance, meaning the story is primarily about United States politics, society, sport or domestic affairs.
- Demotes anything at or above a threshold you set with one slider (default 70). Higher hides less, lower hides more.
- Targets topics, not publishers. A US election story on the BBC is caught; a UK story on a US site is not.
- Never deletes. A demoted item becomes a 28 px bar reading "US story hidden · tap to reveal". Clicking it restores the original and remembers your choice for the session.

## How classification works

Classification is tiered so the fast, free, private path handles most cases:

1. **Local rules.** Weighted keyword and entity scoring against a seed list of US politicians, agencies, states, cities and leagues, with counter-signals for UK, EU and international topics. Confident results (comfortably below 25 or above 75) are used immediately.
2. **Local cache.** Ambiguous headlines are looked up in a hashed verdict cache in the browser.
3. **Remote LLM.** Only genuine unknowns are batched (at most 20, debounced 400 ms) to your own Vercel deployment, which checks its KV cache and calls a cheap Haiku-class model only for true misses.

Every tier returns the same shape: `{ hash, score, source, confidence }`.

## Privacy

Only normalised headline text ever leaves your machine, and only to your own deployment. URLs and full page content never do. See `docs/privacy.md`.

## Repository layout

```
extension/   WebExtensions MV3 source (plain JavaScript), bundled to extension/dist
api/         Vercel serverless functions: classify and selectors, KV cache, LLM client
data/        Seed entity and publisher lists
docs/        Install guide, privacy note and per-phase working plans
```

## Getting started

```bash
npm install
npm test        # run the unit tests
npm run build   # bundle the extension into extension/dist
```

Then load `extension/` as an unpacked extension (see `docs/install-guide.md`). The cloud classifier is optional: without it, Hemisphere runs on local rules and cache alone.

## Cross-browser support

One codebase targets Chrome, Edge and Firefox via WebExtensions Manifest V3. Safari is out of scope for now, and nothing here hard-blocks a future port.

## Cost control

The API enforces a hard daily spend cap (default 0.50 USD). Once the day's estimated LLM spend is exceeded, the API serves cache and rules verdicts only and marks the response degraded, which the extension handles silently.
