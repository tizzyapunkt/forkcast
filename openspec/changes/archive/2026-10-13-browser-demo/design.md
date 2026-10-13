# Design

## Context

See proposal.md for the motivation. Current state that shapes the approach:

- **The backend is one factory.** `createApp(deps)` in `backend/src/app.ts` builds the whole Hono app from ready-made ports. Hono runs on the Fetch API, so `app.fetch(request)` works in a browser. Adapters persist only through the `JsonDocument` port (`read(): Promise<string | null>`, `write(text)`).
- **Node-only code `createApp` pulls in.** Three files: `domain/auth/auth.service.ts` (`createHmac`, `timingSafeEqual`, `Buffer` from Node), `domain/shopping/import-token.ts` (`createHmac`) and `http/ai-images/decode-image-payloads.ts` (`Buffer`). `file-json-document.ts` and the Anthropic adapters are built only in `index.ts`, so they stay out. The use cases call the global `crypto.randomUUID()`, which browsers have on HTTPS.
- **Typechecking backend code as frontend code.** A probe compiled `app.ts` under the frontend's `tsconfig.json`. It gave 13 errors: the three Node files above, plus the frontend's `ES2020` lib, which lacks `Map.groupBy`, `Array.prototype.at`, `replaceAll` and the `Error` `cause` option.
- **Frontend.** Every API call is a `fetch('/api/...')` with an absolute path: `fetchJson` in `api/client.ts`, plus direct calls in `api/auth.ts`, a few `api/*` modules and the two AI "configured" probes. There is no router; views are React state. `main.tsx` wraps `<App/>` in `<AuthGuard>` and calls `registerSW` from `virtual:pwa-register`. Changing the language writes `forkcast:locale` to `localStorage` and reloads.
- **Hiding the AI features.** Recipe import and product capture already hide themselves when their probe gets a `503`, which `createApp` answers when `deps.ai` is null. AI resolution is reached only through recipe import. The catalog editor's AI fill button and Settings' diagnostics link and logout button are always shown. The grocery sheet always shows Bring!.
- **Seed.** `scripts/demo/seed-demo-data.mts` (460 lines) seeds a goal, weight entries, recipes and the current week through the HTTP API with one `call(method, path, body)` helper. Login, the "already seeded" guard and the printed summary wrap that core.
- **Open Food Facts from a browser** (probed 2026-10-13 with `Origin: https://check-forkcast.tizzy.dev`):
  - Barcode (`world.openfoodfacts.org/api/v2/product/...`) answers with `Access-Control-Allow-Origin: *`.
  - Name search (`search.openfoodfacts.org/search`) sends no `Access-Control-Allow-Origin` for any origin we tried, and its preflight returns `400`.
  - The OFF SDK sends `credentials: "include"` and a `User-Agent` header. Credentials are incompatible with `*`, and the header forces a preflight.
- **Website.** `website.yml` builds `website/` and uploads `website/dist` to Pages, but only on changes under `website/**`. The privacy policy's "No cookies" section says the site stores nothing in the browser.

## Goals / Non-Goals

**Goals:**

- The demo runs the unchanged handlers, use cases and domain code; only adapters and wiring differ.
- The normal build is unchanged: no demo code and no backend code in its bundle, and the PWA works as before.
- The server behaves exactly as before after the Web Crypto refactor.

**Non-Goals:**

- A server-side demo, sessions or rate limiting.
- An OFF name-search fallback (snapshot or proxy). That is the follow-up `off-snapshot` change, if the phone test confirms the block.
- Syncing the demo across devices, or exporting and importing demo data.
- Translating seeded data in place when the language changes. A reset in the new language replaces it.

## Decisions

### 1. The demo is a Vite mode of the frontend, not a separate app

`vp build --mode demo` builds into `frontend/dist-demo/` with `base: '/demo/'`. A single `isDemo` constant (`import.meta.env.MODE === 'demo'`, in `src/demo/is-demo.ts`) drives every difference. In `main.tsx` the demo branch is `if (isDemo) await import('./demo/start-demo')`. Vite replaces `MODE` statically, so in the normal build the branch and the dynamic import are dropped, and no backend code is bundled.

*Alternatives:* a second Vite config or a second HTML entry. Both duplicate the plugin and Tailwind setup for no gain. A runtime flag (a query parameter) would ship the backend to every self-hoster.

### 2. A fetch shim routes `/api/*` into `app.fetch`

`installDemoApi(app)` wraps `globalThis.fetch`. A request whose URL resolves to the page's origin with a path starting `/api/` is rebuilt as `http://demo.local/<rest>` (the prefix stripped, as the dev proxy and nginx do), with method, headers and body kept, and handed to `app.fetch`. Every other request goes to the real `fetch`. That includes OFF requests, which run inside the same page.

*Why:* every call site already uses `/api/...`, so nothing in `api/` changes.

*Alternative:* a service worker as the "server". Rejected: it adds a second runtime, ties the demo to SW lifecycle quirks and conflicts with turning off install (Decision 7).

### 3. `createApp` without auth, and a browser-safe import graph

- **Optional auth.** `AppDeps.auth` becomes optional. Without it, `createApp` registers no `/auth/*` routes, no auth middleware and no Bring! routes (`/bring-import/:token` and `/bring-import-token`, which need a signing secret and a public server). The server always passes auth, and `index.ts` still exits without `AUTH_PASSWORD` / `AUTH_JWT_SECRET`, so the server behaves as before.
- **Web Crypto instead of Node.**
  - `verifyPassword` compares HMAC-SHA-256 digests from `crypto.subtle` with a constant-time loop over the bytes.
  - `importTokenKey` derives its key with `crypto.subtle` HMAC.
  - Both become `async`. Their callers are already async handlers.
  - `decodeImagePayloads` decodes base64 with `atob`.

  All of this runs unchanged on Node 24 and in browsers. Existing auth, Bring! and image tests pin the behavior: the same tokens verify, and wrong passwords still fail.
- **Frontend `lib`.** The frontend `tsconfig.json` raises `target`/`lib` to `ES2023` plus `ESNext.Collection` (or `ES2024` if the installed TypeScript has it), so backend files typecheck when the demo imports them.

*Alternative:* a separate browser `createDemoApp` that re-registers the routes. Rejected: two route tables drift.

### 4. `IndexedDbJsonDocument` in the frontend

`src/demo/indexeddb-json-document.ts` implements the backend `JsonDocument` interface over one IndexedDB database (`forkcast-demo`) with one object store (`documents`), keyed by document name (`log-entries`, `recipes`, `catalog`, …). `location` is `indexeddb:forkcast-demo/<name>`. `resetDemoStore()` deletes the database. Tests use `fake-indexeddb` (new dev dependency).

- The catalog document is a `JsonCatalogStore` seeded with `backend/data/catalog.json` (73 KB) imported as text. That is the same seed a fresh server installs.
- The demo's diagnostics log is the in-memory one, and it is never shown.

*Alternative:* `localStorage`. Simpler, but synchronous and capped at about 5 MB, and the proposal chose IndexedDB.

### 5. The seed core is shared between the script and the demo

The body of `seed-demo-data.mts` (goal, weights, recipes, the week) moves into `frontend/src/demo/seed-demo-week.ts`:

```ts
seedDemoWeek(call, { locale, weekStart, today })
```

- `call` is the same `(method, path, body) => Promise<unknown>` helper. The module has no imports, so the Node script can load it with `--experimental-transform-types`.
- The script keeps login, the "recipes exist" guard, env parsing and the summary.
- The demo passes a `call` built on `app.fetch` and the active locale.
- After seeding, a `demo-meta` document records `{ seededLocale }`.

### 6. Demo start, banner and reset

`start-demo.ts` does the following before React renders:

1. Builds the deps (IndexedDB repositories, the catalog, OFF with the demo fetch from Decision 8, no AI, no auth) and calls `createApp`.
2. Installs the shim.
3. Seeds if `demo-meta` is missing. A half-finished seed (the tab closed mid-way) leaves no meta, so the next start resets the store and seeds again.

`main.tsx` renders `<DemoBanner/>` above `<App/>` without `<AuthGuard>`. The banner is in `src/demo/`, built from existing primitives (`Banner`, `Button`), with messages in `de.ts`/`en.ts`. It shows:

- "Demo – your data stays in this browser" and a **Reset demo** button, which resets the store, clears the React Query cache by reloading, and seeds again in the active locale on start.
- When `seededLocale` differs from the active locale: **Reset demo in English** or **Demo auf Deutsch zurücksetzen**, plus a note that the data is in the other language.

No native `confirm`. A reset is cheap and the banner says what it does.

**The first-visit disclaimer.** `DemoIntro` is a bottom sheet built on the existing `components/app/bottom-sheet.tsx`, opened over the app on the first visit. Its content:

- the demo runs locally in this browser, and nothing goes to a forkcast server;
- the data stays in this browser, and **Reset demo** in the banner starts over;
- turned off, because each needs a server or an API key: recipe import from photos, product capture from photos, AI fill and AI resolution, Bring!, and the diagnostics screen.

One button ("Got it" / "Verstanden") closes the sheet. Dismissing it writes `forkcast-demo:intro-seen` to `localStorage`, wrapped in try/catch: without storage the sheet just shows again next visit. The flag is stored outside the demo's IndexedDB on purpose, so a reset, which deletes that database, does not show the sheet again. The banner already carries the short version.

*Alternative:* store the flag in `demo-meta`. Rejected: a reset would show the disclaimer again to someone who has already read it.

### 7. Hiding features and turning off install

- `isDemo` hides:
  - the Bring! button in `grocery-list-sheet.tsx`;
  - the diagnostics link and the logout button in `settings-screen.tsx`;
  - the AI fill button in `catalog-entry-editor.tsx`.
- Recipe import and product capture hide themselves via their existing 503 probes, because the demo passes `ai: null`.
- `VitePWA({ disable: mode === 'demo', … })` keeps the `virtual:pwa-register` module but generates no service worker. `main.tsx` skips `registerSW` in the demo. The built `dist-demo/index.html` must carry no manifest link; if the plugin still injects one, the config adds `manifest: false` in demo mode.

### 8. OFF from the browser through the existing adapter

The demo builds `new OpenFoodFactsService(demoOffFetch)`. `demoOffFetch` re-issues the SDK's request as `fetch(url, { method, signal, credentials: 'omit' })` and drops the SDK's headers. With no credentials and no custom headers the request is a CORS "simple request": no preflight, and `*` is accepted. That makes barcode lookup work. Name search goes through the same path, and if the browser blocks it, the composite already logs the failure and returns the other sources' results.

*Alternative:* write a second OFF client for the browser. Rejected: the adapter takes a `fetch` precisely for this.

### 9. Publishing

- **Builds.** `frontend/package.json` gains `build:demo` (`vp build --mode demo`). `make check` runs it after `website-build`, so a demo that no longer builds fails the gate.
- **Workflow.** `website.yml`:
  - builds the website, then the demo, and copies `frontend/dist-demo/` to `website/dist/demo/`;
  - triggers on `website/**`, `frontend/**`, `backend/src/**`, `backend/data/catalog.json` and `scripts/demo/**` as well.
- **Privacy policy.** A "Demo" section is added in EN and DE, and the "No cookies" section gets "except the demo, see below".

## Risks / Trade-offs

- [OFF name search is blocked by CORS, as the probe suggests] → The demo still works with catalog search and barcode lookup. The user's phone test confirms or refutes it, and `off-snapshot` follows if needed.
- [The demo bundle carries Hono, jose, the OFF SDK and the backend] → Only the demo pays; it is loaded through the dynamic import. Expect a few hundred KB gzipped; acceptable for a demo.
- [Web Crypto refactor changes security-relevant code] → Same algorithms (HMAC-SHA-256, HS256 JWT). Existing tests for login, sessions and Bring! tokens must pass unchanged. A server smoke run (`make smoke`) covers the login round trip.
- [Raising the frontend `lib` lets app code use ES2023+ APIs] → All browsers that run the app's other features support them. Vite does not polyfill either way.
- [A visitor's demo data grows stale, since the week is seeded relative to the first visit] → Reset reseeds the current week. The banner makes reset visible.
- [`crypto.randomUUID` needs a secure context] → GitHub Pages serves HTTPS, and `localhost` counts as secure for local testing.

## Migration Plan

- **Deploy.** Merging deploys the demo with the next website deploy.
- **Server.** Unchanged in behavior. The Web Crypto refactor ships in the next backend image.
- **Rollback.** Revert the commit. The demo disappears with the next website deploy, and visitors' IndexedDB data is simply left unused.

## Open Questions

- The exact demo banner copy (EN and DE). Settled during implementation, in the tone of the app's existing messages.
