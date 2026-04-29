## 1. Backend — BLS build script & data artifact

- [x] 1.1 Add `backend/scripts/build-bls-data.ts` that reads `BLS_4_0_Daten_2025_DE.csv` from the repo root, strips the UTF-8 BOM, splits on `\r?\n`, and parses semicolon-delimited rows
- [x] 1.2 In the build script, keep only `BLS Code`, `Lebensmittelbezeichnung`, `Food name`, `ENERCC Energie (Kilokalorien) [kcal/100g]`, `PROT625 Protein (Nx6,25) [g/100g]`, `FAT Fett [g/100g]`, `CHO Kohlenhydrate, verfügbar [g/100g]` (resolve column indices from the header row by exact label match)
- [x] 1.3 Convert German `,` decimal separator to `.` per cell; drop rows where kcal is missing/unparseable; round each macro to 3 decimals to keep the JSON small
- [x] 1.4 Emit `backend/data/bls.json` as an array of `{ id, name_de, name_en, calories100, protein100, carbs100, fat100 }` (per-100g values stored as numbers)
- [x] 1.5 Add an `npm` script `build:bls` to `backend/package.json` running the script via `tsx`
- [x] 1.6 Run `pnpm --filter @forkcast/backend build:bls` once and commit the resulting `bls.json`
- [x] 1.7 Write a test that loads a fixture CSV (small inline string) through the build-script's parsing function and asserts: row count, German decimal handling, missing-kcal exclusion, BOM stripping

## 2. Backend — BLS domain & in-memory adapter (TDD)

- [x] 2.1 Add `backend/src/domain/ingredient-search/fold.ts` with `fold(s: string): string` (NFD normalize + strip `\p{Diacritic}` + `toLowerCase`); covered by tests for `Käse → kase`, `MÖHRE → mohre`, ASCII passthrough, empty string
- [x] 2.2 Add `backend/src/domain/bls/types.ts` with the `BlsEntry` shape (raw per-100g values) and the runtime-shape `BlsIndexedEntry` (with precomputed folded names)
- [x] 2.3 Add `backend/src/domain/bls/map-bls-entry.ts` that maps a `BlsEntry` to `IngredientSearchResult` (`source: 'BLS'`, `id`, `name = name_de`, `unit: 'g'`, macros divided by 100); test the mapping including the per-gram scaling
- [x] 2.4 Failing test + implement `backend/src/infrastructure/ingredient-search/in-memory-bls.service.ts` implementing `IngredientSearchService`: `init()` loads `bls.json` and precomputes folded names; `searchByName(q)` returns at most 20 matches sorted by `name_de`; `searchByBarcode()` returns `null`; queries shorter than 2 chars (after trim) return `[]`
- [x] 2.5 Tests cover: diacritic fold match, English-name fallback, case-insensitive match, 20-result cap, short-query empty, no-match empty

## 3. Backend — generic search-result shape (BREAKING within search domain)

- [x] 3.1 Modify `backend/src/domain/ingredient-search/types.ts`: replace `offId` with `id: string`, add `source: 'OFF' | 'BLS'`
- [x] 3.2 Modify `backend/src/domain/ingredient-search/map-off-product.ts` to set `source: 'OFF'` and `id` (from `product.code`); update `map-off-product.test.ts`
- [x] 3.3 Run backend tests; fix any other call site that referenced `offId`

## 4. Backend — composite search service

- [x] 4.1 Failing test + implement `backend/src/infrastructure/ingredient-search/composite-ingredient-search.service.ts` implementing `IngredientSearchService`: holds an OFF service and a BLS service; `searchByName` runs both with `Promise.allSettled`, concatenates `[...blsHits, ...offHits]`, logs rejected sources via `console.error` and continues; `searchByBarcode` delegates to OFF only
- [x] 4.2 Tests cover: both sources contribute and BLS comes first, OFF rejection still returns BLS hits, BLS empty + OFF results yields OFF-only, barcode delegates to OFF only
- [x] 4.3 Wire `InMemoryBlsService` and `CompositeIngredientSearchService` into `backend/src/index.ts` (and `bootstrap.ts` for BLS init); replace the existing `OpenFoodFactsService` injection point

## 5. Frontend — domain types & search panel

- [x] 5.1 Modify `frontend/src/domain/ingredient-search.ts` to mirror the backend: `id: string` + `source: 'OFF' | 'BLS'` (drop `offId`)
- [x] 5.2 Update `frontend/src/features/log-ingredient/search-panel.tsx` so list keys become `${result.source}:${result.id}`, and render a small inline badge displaying `result.source` (`BLS` or `OFF`) before the kcal info
- [x] 5.3 Update any other `offId` reference in the frontend (recipe ingredient picker, recents — confirm with grep) to use the new shape
- [x] 5.4 Update MSW fixtures (`frontend/src/test/msw/fixtures.ts`) and handlers to return both BLS- and OFF-tagged results; existing fixtures keep working with the new field name
- [x] 5.5 Update `search-panel.test.tsx`: assert badge is rendered per row, assert no React duplicate-key warning when an OFF and BLS result share the same id

## 6. Polish & verification

- [x] 6.1 Run full test suite (`pnpm -r test`) — backend + frontend green
- [x] 6.2 Run lint/format (`pnpm -r lint`, project formatter equivalents) — clean
- [x] 6.3 Manual smoke in the browser: search `kase` → BLS results above OFF, each tagged with the right badge; search a packaged-product brand → OFF only; barcode scan still works; daily log unaffected
- [x] 6.4 Add a one-line note to `README.md` (or create one if absent) documenting `pnpm --filter @forkcast/backend build:bls` for regenerating `bls.json` if a new BLS release ships
- [x] 6.5 Update `CLAUDE.md` only if a *new* convention emerged (e.g. build-time data artifacts). If implementation followed existing patterns, no edit required.
