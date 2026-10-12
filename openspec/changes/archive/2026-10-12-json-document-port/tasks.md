# Tasks

## 1. JsonDocument port and adapters

- [x] 1.1 Write failing tests for `FileJsonDocument` (read of a missing file returns null; write creates missing parent directories; write leaves no `<path>.tmp` behind; remove of a missing file is a no-op; `location` is the path), then add `infrastructure/json-document/json-document.ts` (the port) and `file-json-document.ts` until `pnpm --filter @forkcast/backend test` passes
- [x] 1.2 Add `InMemoryJsonDocument` (constructed with an optional initial text and a location label) with a short test of read/write/remove, and verify it passes

## 2. Plain repositories onto the port

- [x] 2.1 Move `JsonLogEntryRepository`, `JsonFavoriteIngredientRepository` and `JsonRecipeRepository` onto `JsonDocument` (constructor takes a document, `init()` removed, same `JSON.stringify(x, null, 2)` output); update their tests to construct through `new FileJsonDocument(path)` with unchanged assertions, and verify they pass
- [x] 2.2 Move `JsonWeightLogRepository`, `JsonNutritionGoalRepository` and `JsonBodyProfileRepository` the same way; verify the weight-log repository test and the handler tests that use these repositories pass
- [x] 2.3 Verify `grep -rn "node:fs\|node:path" backend/src/infrastructure --include='*.ts' | grep -v test` lists only `file-json-document.ts`, the catalog store and the overlay migration (the latter two are moved in group 3)

## 3. Stores and catalog boot onto the port

- [x] 3.1 Move `JsonScannedProductStore` onto `JsonDocument`, keeping its write queue, sorted output with trailing newline and parse-failure warnings; verify `json-scanned-products.store.test.ts` passes through `FileJsonDocument`
- [x] 3.2 Move `JsonCatalogStore` onto `{ document, seed?, legacy? }` documents: same authority order (existing, then legacy adopted by write and remove, then seed copied as unchanged text, then the "cannot seed an empty catalog" error), same log wording with `location`; verify `json-catalog.store.test.ts` and `catalog-seed.test.ts` pass, including the byte-identical seed and the legacy-adoption cases
- [x] 3.3 Add a catalog store test over `InMemoryJsonDocument`s: an empty document with a seed installs the seed, and a later write does not change the seed document. Verify it passes
- [x] 3.4 Move `migrateUserFoodsOverlay` onto an overlay `JsonDocument` (read, merge, `replaceAll`, remove; unparseable overlay left in place); verify `migrate-user-foods-overlay.test.ts` passes and the grep from 2.3 now lists only `file-json-document.ts`

## 4. createApp factory

- [x] 4.1 Write a failing `backend/src/app.test.ts` that builds `createApp` over `InMemoryJsonDocument`-backed repositories, an initialised in-memory catalog and a stub OFF service, then checks: an unauthenticated `GET /daily-log/:date` is 401, login with the deps password succeeds, `POST /log-ingredient` followed by `GET /daily-log/:date` returns the entry, and `GET /search-ingredients?q=…` returns a catalog hit
- [x] 4.2 Add `backend/src/app.ts` with `AppDeps` / `AiDeps` and `createApp(deps)`, moving the middleware and the route list out of `index.ts` as a block in today's order (public routes before the auth middleware; AI routes or the not-configured handlers depending on `deps.ai`); verify 4.1 passes and `app.ts` imports neither `@anthropic-ai/sdk`, `@hono/node-server` nor `node:fs`
- [x] 4.3 Reduce `index.ts` to config loading, building `FileJsonDocument`s from today's paths, `bootstrap([catalogStore])`, the overlay migration, the AI warning, building the Anthropic adapters when a key is set, and `serve({ fetch: createApp(deps).fetch, port: 3000 })`; verify `pnpm --filter @forkcast/backend typecheck` and the full backend test suite pass
- [x] 4.4 Add one sentence to the Backend section of `AGENTS.md` naming `src/app.ts` (`createApp(deps)`) as the wiring and the `JsonDocument` port as the only way adapters persist; verify `make check` passes

## 5. Integration check

- [x] 5.1 Run `scripts/smoke-backend.sh` and verify the round-trip passes against a real data directory
- [x] 5.2 Boot the backend (`pnpm --filter @forkcast/backend dev`) on a copy of an existing data directory, including a legacy `foods.json` and no catalog, and verify that the catalog is adopted, that log, recipes and weight load unchanged in the frontend, and that file contents keep their formatting after one edit each

## 6. Remove the one-off legacy migrations

- [x] 6.1 Delete `migrate-user-foods-overlay.ts`, `domain/food-catalog/merge-overlay.ts` and their tests, and the overlay call in `index.ts`; verify `grep -rn "Overlay\|merge-overlay" backend/src` finds nothing and the backend suite passes
- [x] 6.2 Remove the catalog store's `legacy` option and its adoption step, together with the two legacy tests in `catalog-seed.test.ts`; verify the remaining seed tests (byte-identical install, existing catalog untouched, missing seed fails loudly) pass
- [x] 6.3 Drop `legacyPath` / `legacyOverlayPath` and the `LEGACY_CATALOG_PATH` / `LEGACY_OVERLAY_PATH` settings from `app-config.ts`, and `remove()` from `JsonDocument`, `FileJsonDocument` and `InMemoryJsonDocument` with their tests; verify `grep -rni "legacy_\|legacyPath\|\.remove()" backend/src` lists nothing catalog- or document-related and `make check` passes
- [x] 6.4 Boot the backend on a copy of the real data directory, and verify that it starts, the catalog is used unchanged, and no legacy warning or adoption line is logged

## Workflow follow-up

- Archive the change after review; archiving syncs the `food-catalog` delta (the overlay-migration requirement is removed).
- `browser-demo` builds on `createApp`, `InMemoryJsonDocument` and the catalog's seed document. It adds `remove()` back to the port if its reset needs it.
