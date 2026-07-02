# Phase 4 review: Coverage and control

**Document owner:** Quentin Casares

## Scope delivered

- Full site coverage: selector configs for Google News, BBC, Google search, Reddit (new and old), The Guardian and YouTube, plus a default-off generic fallback. Ordering fixed so `old.reddit.com` resolves to the tighter `reddit-old` config before the broader `reddit` one.
- Selector remote-update endpoint (`/api/selectors`) with a KV override over the shipped seed; the extension merges remote configs over bundled defaults by version.
- Per-site overrides: a "Site exceptions" manager in the options page to add hosts, toggle each, and set a per-site threshold (blank means use the global dial). `effectiveFor` resolves the override on top of the global settings; the popup exposes the per-site enable toggle.
- Topic allowlist as category score adjustments: the LLM returns a category, `applyAllowlist` pulls an allowlisted category's score below any sane threshold, and the background applies it after classification. This shifts the one score; it does not add a second dial.

## Verification

- `npm test` green: 59 tests. New coverage: allowlist adjustment (pull-down, clamp, no-op without category, non-allowlisted untouched), per-site override resolution (threshold override, single-site disable, global disable wins), and site config selection (host and subdomain match, path-prefix requirement for Google search, reddit new vs old, generic fallback gating, and version-based merge of remote updates).
- Build produces the options bundle with the exceptions manager.

## Locked-decision check

- One dial preserved: per-site threshold and the allowlist both act through the single score-versus-threshold comparison; no competing sensitivity mechanism was introduced. Pass.
- Selector breakage fixable without republishing: `/api/selectors` plus daily background refresh and version-based merge. Pass.

## Gaps carried forward

- Real-world selector accuracy per site is inherently a live-tuning task; the remote-update path exists precisely for that and no code change is needed to use it.
- Firefox namespace polyfill, performance budget assertions, privacy sweep and user docs remain for Phase 5.
