# Hemisphere privacy review

**Document owner:** Quentin Casares

## Principle

Only normalised headline text ever leaves your machine, and only to your own deployment. Nothing else is transmitted: not URLs, not full page content, not browsing history, not identifiers.

## What is processed locally and never sent

- Page URLs and the current tab address. The publisher domain is used only as a weak local scoring prior; it is never included in any network request.
- Full page content and the DOM. The scanner reads headline text from matched elements locally and discards the rest.
- The verdict cache. Stored in `chrome.storage.local` keyed by the SHA-256 of the normalised headline. Only the hash, score, confidence and expiry are stored, never the headline text.

## What leaves the machine, and to where

- To your own Vercel deployment only, at `POST /api/classify`, the body is exactly `{ items: [{ hash, text }] }`, where `text` is the normalised headline and `hash` is its SHA-256. This is confirmed by the test in `extension/tests/hardening.test.js`, which asserts the request body contains only `items`, each item contains only `hash` and `text`, and no URL leaks through.
- To your own Vercel deployment only, at `GET /api/selectors`, no page data is sent; the request carries only the shared secret header.

## Access control

The API rejects any request without the correct `x-hemisphere-key` shared secret with 401, and rate limits to 60 requests per minute per key. The extension talks to no third party directly; the only external call the API makes is to the Anthropic Messages API, from your own server, using your own key.

## Data retention

Verdicts are cached for fourteen days locally and in KV, keyed by hash. A daily spend counter is kept in KV for the cost cap. No headline text is retained anywhere in readable, un-hashed form beyond the moment of classification.

## Conclusion

The design satisfies the acceptance criterion that no request leaves the browser except headline batches to the owner's own Vercel deployment.
