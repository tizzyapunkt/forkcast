# Proposal

## Why

For a Show HN, people need to try forkcast without installing it. A hosted multi-user demo server would have to absorb a traffic spike, hold strangers' data and route every visitor's Open Food Facts search through one rate-limited IP. Running the real backend inside the visitor's browser avoids all of that: the demo is static files, each visitor gets their own fresh data, nothing is stored on a server, and Open Food Facts requests come from the visitor's own IP.

## What Changes

- A demo build of the frontend in which the backend's `createApp(deps)` runs in-process. A fetch shim routes the app's `/api/*` requests to it, so the same handlers, use cases and domain code serve the demo.
- A browser `JsonDocument` adapter (IndexedDB) holds the demo data. Each browser has its own, separate data.
- On the first visit the demo seeds a believable week relative to today (recipes, a planned week, goals, weight entries), reusing the logic of `scripts/demo/seed-demo-data.mts`, in the browser's language (EN or DE).
- Switching the UI language in the demo offers to reset the demo in the new language, so seeded names are not half translated.
- On the first visit, a disclaimer says the demo runs locally in the browser and that features needing a server are turned off, naming them. It is shown once per browser.
- A demo banner says this is a demo and that the data stays in the browser, and offers "Reset demo".
- Open Food Facts search and barcode lookup are called from the browser directly, using the same OFF adapter as the self-hosted backend, without credentials or custom headers. A probe on 2026-10-13 showed that the barcode endpoint allows any origin, but the name-search endpoint (search-a-licious) sends no CORS headers, so browsers will likely block it. This change still builds the direct call, as decided. If the phone test confirms the block, a follow-up change (`off-snapshot`) replaces OFF name search in the demo with a bundled snapshot. Until then a blocked OFF search degrades to catalog-only results.
- In the demo: no login (no password, no logout); AI features (recipe photo import, package capture, AI fill and resolution) stay hidden because no API key exists; Bring! export is hidden (Bring's servers cannot reach a browser); the diagnostics log screen is hidden.
- Installing the demo as a PWA is turned off (no manifest or install prompt), so a demo never lands on a home screen looking like the real app.
- The demo is published as static files at `https://check-forkcast.tizzy.dev/demo/` by the website workflow (Vite `base` and router basename `/demo/`).
- The website's privacy policy (EN and DE) gains a section on the demo: its data stays in the visitor's browser, and searches and barcodes go from the visitor's browser to Open Food Facts, which sees their IP. The "No cookies" section, which says the site stores nothing in the browser, gets an exception for the demo. It ships with the demo, since the demo is public once deployed.

## Capabilities

### New Capabilities

- `demo-mode`: the in-browser demo build: in-process backend, per-browser storage, seeding in the visitor's language, reset, which features are hidden, no install, and where it is published.

### Modified Capabilities

- `single-user-auth`: the frontend's authentication check and login page do not apply to the demo build.

## Impact

- Frontend: demo build entry and Vite config, fetch shim, IndexedDB `JsonDocument` adapter, demo banner and reset, feature hiding (Bring, diagnostics, logout), PWA plugin disabled for the demo build, locale-switch reset prompt.
- Backend: everything `createApp` imports must run in a browser. Session signing, Bring! import tokens and image decoding move from `node:crypto` / `Buffer` to Web Crypto and plain base64 decoding, with unchanged behavior on the server. `AppDeps.auth` becomes optional: without it the app serves no login, session or Bring! routes. The seed logic is shared between the script and the demo.
- Website: `.github/workflows/website.yml` builds the demo into `website/dist/demo/` and triggers on frontend/backend changes too; privacy policy pages in EN and DE.
- Depends on `json-document-port`; works best after `off-search-worldwide`. `show-hn-readme-and-site` links to it.
- Open Food Facts results keep their "Open Food Facts" source label in the demo, as in the app.
