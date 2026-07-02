# Hemisphere install guide (one page)

**Document owner:** Quentin Casares

## 1. Build the extension

```bash
npm install
npm run build
```

This produces `extension/dist`. The `extension/` folder is now loadable.

## 2. Load the extension

**Chrome or Edge**

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on Developer mode.
3. Choose "Load unpacked" and select the `extension/` folder.
4. The Hemisphere icon appears in the toolbar. Click it to see the popup.

**Firefox**

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose "Load Temporary Add-on" and select `extension/manifest.json`.
3. Firefox 121 or later is required.

## 3. Optional: deploy the cloud classifier

The extension works on local rules and cache alone. To enable the LLM tier for ambiguous headlines:

1. Deploy the `api/` folder to Vercel as its own project.
2. Attach a Vercel KV store to the project.
3. Set the environment variables from `api/.env.example`:
   - `API_KEY`: a shared secret you invent.
   - `ANTHROPIC_API_KEY`: your Anthropic key.
   - `LLM_MODEL`: the cheapest current Haiku-class model id.
   - `DAILY_CAP_USD`: optional, defaults to 0.50.
4. `KV_REST_API_URL` and `KV_REST_API_TOKEN` are provided automatically when you attach KV.

## 4. Connect the extension to your deployment

1. Open the extension options page (via the popup's "Full settings" link).
2. Enter your Vercel base URL, for example `https://hemisphere.vercel.app`.
3. Enter the same `API_KEY` you set on Vercel.
4. Save.

## 5. Daily use

- The toolbar popup has the on/off switch, the single threshold slider, a per-site toggle and a counter of items demoted on the current page.
- The options page has the topic allowlist (keep US technology while still demoting US politics), site exceptions and the cloud credentials.
- A demoted item shows a grey bar reading "US story hidden · tap to reveal". Click it to restore the story for the rest of the session.

## Troubleshooting

- **Nothing is demoted.** Check the extension is enabled and the threshold is not at 100. On an unknown site, enable the generic fallback in options.
- **A site stopped collapsing.** Site layouts change. Selector fixes are served from `/api/selectors` and refreshed daily, so no reinstall is needed once a fix is published.
- **Scores look off without the cloud tier.** Local rules are deliberately conservative on ambiguous headlines. Connect the cloud classifier for the LLM tier.
