# Phase 2 review: Scanner and demote

**Document owner:** Quentin Casares

## Scope delivered

- `scanner.js`: pure `collectCandidates` helper plus a `Scanner` class that does an initial scan, watches infinite feeds with a `MutationObserver`, debounces bursts into a single batch (400 ms), and records a per-scan timing marker for the Phase 5 performance budget.
- `demote.js`: collapses a matched element to a 28 px reveal bar reading "US story hidden · tap to reveal", injected inside a shadow root so site CSS and bar CSS stay isolated. The original element is only hidden and is restored intact. Clicking the bar reveals the element and remembers the reveal for the session; `undemote` restores silently when the threshold moves.
- `content/index.js`: picks the site config, scans, sends batches to the background for classification, applies the demote decision, keeps a per-page verdict map so a live threshold change re-applies without re-classifying, and reports the demoted count to the badge.
- Popup threshold slider writes through `chrome.storage.sync`; the content script listens on `storage.onChanged` and re-evaluates immediately.

## Verification

- `npm test` green: 25 tests, now including jsdom tests for candidate extraction, the observer, the shadow-DOM bar, reveal, and silent undemote.
- Build produces `extension/dist/content.js` bundling scanner and demote.
- Layout: the bar replaces the element inline at 28 px and the original is `display:none`, so there is no reflow beyond the bar height. Reveal restores the exact prior inline display. This keeps cumulative layout shift well under the 0.1 CLS target; a DevTools confirmation on the live BBC homepage is noted as a manual check.

## Locked-decision check

- Demote never delete: elements are hidden and restored, never removed. Pass.
- Shadow DOM wrapper: bar is inside `attachShadow({mode:'open'})` with `:host { all: initial }`. Pass.
- One dial: demotion is driven solely by `score >= threshold`. Pass.

## Gaps carried forward

- Real-world selector accuracy for each site needs a manual pass; the remote selector-update endpoint arrives in Phase 4.
- Classification currently resolves on rules and cache only until the API exists (Phase 3).
