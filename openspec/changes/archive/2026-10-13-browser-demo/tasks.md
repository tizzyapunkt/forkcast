# Tasks

## 1. Make the backend app browser-safe

- [x] 1.1 Move `verifyPassword` in `domain/auth/auth.service.ts` to Web Crypto (HMAC-SHA-256 digests via `crypto.subtle`, constant-time byte comparison, now `async`) and await it in `login.handler.ts`. Verify the auth service and login handler tests pass unchanged except for the `await`, and that no `node:crypto` import remains in the file
- [x] 1.2 Move `importTokenKey` in `domain/shopping/import-token.ts` to `crypto.subtle` HMAC. Verify the import-token and Bring! handler tests pass, including a token minted by the old implementation for a fixed secret and date, captured as a test fixture before the change, still verifying
- [x] 1.3 Replace `Buffer.from(…, 'base64')` in `http/ai-images/decode-image-payloads.ts` with `atob`-based decoding. Verify the decode tests and the two photo handler tests pass
- [x] 1.4 Make `AppDeps.auth` optional. Write failing `app.test.ts` cases first: without auth, a protected route such as `GET /recipes` answers 200 with no cookie, and `/auth/login`, `/auth/me`, `/bring-import-token` and `/bring-import/:token` answer 404. With auth, the existing 401 behavior holds. Then change `createApp` until they pass
- [x] 1.5 Verify the backend import graph of `app.ts` has no `node:` imports and no `Buffer` (grep), and that `make test-backend` and `make smoke` pass

## 2. Share the seed between the script and the demo

- [x] 2.1 Move the seed core (goal, weights, recipes, the week) from `scripts/demo/seed-demo-data.mts` into `frontend/src/demo/seed-demo-week.ts` as `seedDemoWeek(call, { locale, weekStart, today })`, with no imports. Reduce the script to env parsing, login, the "recipes exist" guard, the call and the summary. Verify by running the script against a scratch backend (forkcast-dev skill, _Landing-page screenshots_ steps 1 and 2) for `en` and `de`: both seed, and the summary prints the same day totals as before the move
- [x] 2.2 Add a frontend test that runs `seedDemoWeek` against an in-memory `createApp` (in-memory documents, catalog from `backend/data/catalog.json`, no auth, no AI) for `en` and `de`. Verify the week log for `weekStart` has entries on all seven days and recipe names are in the requested language

## 3. Demo storage and in-page API

- [x] 3.1 Add `fake-indexeddb` as a frontend dev dependency. Write `src/demo/indexeddb-json-document.test.ts` first: `read` of a new document is null, `write` then `read` round-trips, two names are independent, a second instance on the same database sees the data, and `resetDemoStore()` empties everything. Then implement `IndexedDbJsonDocument` and `resetDemoStore` until it passes
- [x] 3.2 Write `src/demo/demo-api.test.ts` first: with the shim installed over a stub app, `fetch('/api/recipes')` reaches the app as `GET /recipes`, a `POST` keeps its JSON body and headers, a non-`/api` URL and a cross-origin URL go to the original `fetch`, and uninstalling restores `fetch`. Then implement `installDemoApi(app)` until it passes
- [x] 3.3 Write `src/demo/demo-off-fetch.test.ts` first: the wrapped request keeps the URL, method and abort signal, sends `credentials: 'omit'` and drops the SDK's headers. Then implement `demoOffFetch` until it passes

## 4. Demo start, banner and reset

- [x] 4.1 Add `src/demo/is-demo.ts` and `src/demo/start-demo.ts`. `startDemo()` builds the deps (IndexedDB documents, `JsonCatalogStore` seeded with `catalog.json` as text, `OpenFoodFactsService(demoOffFetch)`, in-memory diagnostics, `ai: null`, no auth), calls `createApp`, installs the shim, and seeds with the active locale when `demo-meta` is missing (resetting a half-seeded store first). Then it writes `{ seededLocale }`. Verify with a test on `fake-indexeddb`: the first start seeds, a second start does not reseed, and a start after reset seeds again
- [x] 4.2 Raise the frontend `tsconfig.json` `target`/`lib` so the backend files the demo imports typecheck (Decision 3). Verify `make typecheck` passes with the demo entry included
- [x] 4.3 Build `DemoBanner` from the existing primitives, with EN/DE messages in `i18n` (keys mirrored, per `de.test.ts`/`en.test.ts`). It shows the demo note and **Reset demo**, plus **Reset demo in <active language>** when `seededLocale` differs from the active locale. Write the tests first: the note and reset are always shown, the language offer appears only on a mismatch, and each button resets the store and reloads. Verify they pass
- [x] 4.4 Build `DemoIntro`, the first-visit disclaimer sheet on `BottomSheet` (Decision 6), with EN/DE messages naming the turned-off features. Write the tests first: it opens when `forkcast-demo:intro-seen` is absent, "Got it" closes it and sets the flag, it stays closed when the flag is set, it stays closed after `resetDemoStore()`, and a throwing `localStorage` still lets it open and close. Verify they pass
- [x] 4.5 Wire `main.tsx`: in the demo, `await startDemo()`, render `<DemoBanner/>` above `<App/>` and `<DemoIntro/>` over it, without `<AuthGuard>`, and skip `registerSW`. Verify the normal `vp build` output contains no demo or backend code (grep `dist/assets` for `forkcast-demo` and `bring-import`), and `make test-frontend` passes

## 5. Hide what the demo cannot do, turn off install

- [x] 5.1 Hide the Bring! button (`grocery-list-sheet.tsx`), the diagnostics link and the logout button (`settings-screen.tsx`), and the AI fill button (`catalog-entry-editor.tsx`) when `isDemo`. Write a test per screen with `is-demo` mocked to true, asserting the control is absent and the rest of the screen still renders. Verify the existing tests still pass with it false
- [x] 5.2 Add the `demo` mode to `frontend/vite.config.ts`: `base: '/demo/'`, `build.outDir: 'dist-demo'`, `VitePWA({ disable: true })` (plus `manifest: false` if needed). Add a `build:demo` script and gitignore `dist-demo/`. Verify `pnpm --filter @forkcast/frontend build:demo` succeeds, `dist-demo/index.html` references assets under `/demo/` and has no manifest link, and `dist-demo/` has no `sw.js`
- [x] 5.3 Add `build:demo` to `make check` (after `website-build`). Verify `make check` passes

## 6. Publish with the website

- [x] 6.1 Extend `.github/workflows/website.yml`: build the demo after the website, copy `frontend/dist-demo/` to `website/dist/demo/`, and add `frontend/**`, `backend/src/**`, `backend/data/catalog.json` and `scripts/demo/**` to the trigger paths. Verify with `ruby -ryaml` that the workflow parses, and locally by running the same build and copy commands, then `pnpm --filter @forkcast/website preview` serving `/demo/`
- [x] 6.2 Add a demo section to `website/privacy/index.html` and `website/de/datenschutz/index.html`: storage only in the visitor's browser (IndexedDB and the language choice), and OFF searches and barcodes sent from the visitor's browser to Open Food Facts, which sees their IP, with a link to OFF's privacy policy. Amend "No cookies" / "Keine Cookies" with the demo exception. Verify `make website-build` passes and both pages render the section
- [x] 6.3 Update `AGENTS.md` (Website section: the demo at `/demo/`, built from `frontend` in `demo` mode, and how to run it locally) and the `forkcast-dev` skill (a `build:demo` / preview line). Verify the documented commands run as written

## 7. Integration check

- [x] 7.1 Serve the built site with the demo (`website preview`) and walk the demo in Chrome (forkcast-dev skill, browser smoke test) in both languages:
  - the first visit shows the disclaimer naming the turned-off features; after "Got it", a reload and a reset do not show it again;
  - the first visit seeds the current week;
  - log a food and reload, and it persists;
  - Reset demo restores the seed;
  - switching EN to DE shows the reset offer, and choosing it reseeds in German;
  - no login page, and no Bring!, diagnostics, logout, AI fill or photo import;
  - barcode lookup of a known product works;
  - a search with OFF on shows catalog results even if the OFF request is blocked (record what the browser console says about CORS);
  - the network panel shows no requests to a forkcast server.
- [x] 7.2 Run `make check` and verify it passes

## Workflow follow-up

- The user tests the deployed demo on a phone. If OFF name search is blocked, propose `off-snapshot`.
- Archive the change after review; archiving creates the `demo-mode` spec and syncs the `single-user-auth` delta.
