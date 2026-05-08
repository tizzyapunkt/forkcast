## 1. Domain types and indexing (TDD)

- [x] 1.1 Add `backend/src/domain/foods/types.ts` defining `FoodEntry`, `PieceWeight`, and `FoodIndexedEntry`
- [x] 1.2 Write `backend/src/domain/foods/validate-food-entry.test.ts` covering the validation scenarios from `curated-foods-source` spec (good entry with pieces, good entry without pieces, non-positive `grams`, canonical-equals-synonym, missing/negative `calories`)
- [x] 1.3 Implement `backend/src/domain/foods/validate-food-entry.ts` returning `{ ok: true, entry }` or `{ ok: false, reason }`
- [x] 1.4 Write `backend/src/domain/foods/index-food-entry.test.ts` asserting that canonical `name` and each synonym are folded via the existing `fold` helper into a `FoodIndexedEntry`
- [x] 1.5 Implement `backend/src/domain/foods/index-food-entry.ts`
- [x] 1.6 Write `backend/src/domain/foods/map-food-entry.test.ts` asserting `IngredientSearchResult` shape (source `'FOODS'`, id, unit `'g'|'ml'`, scaled macros)
- [x] 1.7 Implement `backend/src/domain/foods/map-food-entry.ts`

## 2. FOODS scoring (TDD)

- [x] 2.1 Write `backend/src/domain/ingredient-search/score-food-match.test.ts` covering: exact canonical, whole-word canonical, prefix canonical, token-start canonical, substring canonical, exact synonym, canonical outranks synonym at same tier, best-of-many-synonyms, no match
- [x] 2.2 Implement `backend/src/domain/ingredient-search/score-food-match.ts` reusing the tier algorithm from the now-removed `score-bls-match.ts` (canonical uses the higher tier values, synonyms use the lower tier values, max wins)

## 3. IngredientSource union flip

- [x] 3.1 Update `backend/src/domain/ingredient-search/ingredient-search.service.ts` to declare `IngredientSource = 'FOODS' | 'OFF'`
- [x] 3.2 Update `backend/src/domain/ingredient-search/types.ts` to declare `source: 'FOODS' | 'OFF'` on `IngredientSearchResult`
- [x] 3.3 Update `backend/src/infrastructure/ingredient-search/open-food-facts.service.ts` (and any OFF mapper) so the produced result still has `source: 'OFF'` (no behavioural change)

## 4. In-memory FOODS adapter (TDD)

- [x] 4.1 Write `backend/src/infrastructure/ingredient-search/in-memory-foods.service.test.ts` covering: init with valid file, init skips malformed entries with a single warning, search returns canonical name on synonym match, search is diacritic-insensitive, queries shorter than 2 chars return `[]`, results are capped at 20, ranking + tie-break match the spec, `searchByBarcode` returns `null`
- [x] 4.2 Implement `backend/src/infrastructure/ingredient-search/in-memory-foods.service.ts` using `validateFoodEntry`, `indexFoodEntry`, `scoreFoodMatch`, and `mapFoodEntry`

## 5. Composite service rewire (TDD)

- [x] 5.1 Update `backend/src/infrastructure/ingredient-search/composite-ingredient-search.service.test.ts` so it exercises FOODS+OFF (rename test fixtures, set default `sources` to `new Set(['OFF'])`); cover: default skips FOODS, both sources fan out in parallel, FOODS-only skips OFF, one-source-fails-other-still-returns
- [x] 5.2 Update `backend/src/infrastructure/ingredient-search/composite-ingredient-search.service.ts`: rename constructor params (`foods` instead of `bls`), flip `DEFAULT_SOURCES` to `new Set(['OFF'])`, ensure FOODS hits come before OFF hits when both requested

## 6. HTTP handler default flip (TDD)

- [x] 6.1 Update `backend/src/http/ingredient-search/search-ingredients.handler.test.ts` to assert: `sources` absent → only OFF queried; `?sources=foods` → only FOODS queried; `?sources=foods,off` → both queried; `?sources=foods,unknown` → only FOODS; `?sources=bls` → falls back to default OFF (legacy `bls` is now an unknown value)
- [x] 6.2 Update `backend/src/http/ingredient-search/search-ingredients.handler.ts`: change `VALID_SOURCES` to `{'foods','off'}`, `SOURCE_MAP` to `{ foods: 'FOODS', off: 'OFF' }`, default fallback to `new Set(['OFF'])`

## 7. AI recipe importer source pin (TDD)

- [x] 7.1 Update `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.test.ts` so the fake `IngredientSearchService` asserts that `searchByName` is called with `sources = new Set(['FOODS'])` (not the default)
- [x] 7.2 Update `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.ts` to call `search.searchByName(raw.name, new Set(['FOODS']))`
- [x] 7.3 Update `backend/src/http/ai-recipe-import/import-recipe-from-photos.handler.test.ts` if it pins source assumptions about the catalog

## 8. Build script (TDD)

- [x] 8.1 Add `backend/scripts/foods-seed-keys.ts` exporting a `FOODS_SEED_KEYS: ReadonlyArray<string>` of 100–150 hand-curated kebab-case ids covering vegetables, fruits, meats, fish, eggs, dairy, basic grains/legumes (the file is hand-edited, not generated)
- [x] 8.2 Define an Anthropic tool-use schema mirroring `FoodEntry` in `backend/scripts/build-foods-tool.ts`
- [x] 8.3 Write `backend/scripts/build-foods-data.test.ts` covering pure helpers in the script: batching keys into chunks of 20, sorting output by `id`, validating-and-collecting failure messages, formatting JSON with a single trailing newline (the AI call itself is not under test — inject a fake batch-runner)
- [x] 8.4 Implement `backend/scripts/build-foods-data.ts`: load seed keys, create Anthropic client from `ANTHROPIC_API_KEY`, run batches of 20 with the tool schema, validate every returned entry, fail fast on missing keys or validation errors, sort by `id`, write `backend/data/foods.json` with a trailing newline
- [x] 8.5 Add `build:foods` script to `backend/package.json` running `tsx scripts/build-foods-data.ts`
- [x] 8.6 Run the build script once locally with `ANTHROPIC_API_KEY` set, hand-review the produced `backend/data/foods.json`, fix any obviously wrong macros / synonyms in place, and commit the curated artifact

## 9. Bootstrap wiring

- [x] 9.1 Update `backend/src/index.ts`: replace `InMemoryBlsService` import and instantiation with `InMemoryFoodsService('./data/foods.json')`; rename the local variable from `blsService` to `foodsService`; pass it as the second arg of `CompositeIngredientSearchService`; include it in `bootstrap([...])`
- [x] 9.2 Verify the AI-recipe-import handler still receives the composite service (no plumbing change beyond rename)

## 10. Frontend — types and API client

- [x] 10.1 Update the frontend `IngredientSearchResult` type (and the source-toggle types) so `source` is `'FOODS' | 'OFF'`
- [x] 10.2 Update `frontend/src/api/search-ingredients.test.ts` to assert serialization of `['FOODS','OFF']` to `sources=foods,off`
- [x] 10.3 Update `frontend/src/api/search-ingredients.ts` accordingly

## 11. Frontend — query hook

- [x] 11.1 Update `frontend/src/queries/use-search-ingredients.test.tsx`: cover the cache-key change for `['OFF'] → ['FOODS','OFF']`
- [x] 11.2 Update `frontend/src/queries/use-search-ingredients.ts` to thread the new source set

## 12. Frontend — search panel toggle flip

- [x] 12.1 Update `frontend/src/features/log-ingredient/search-panel.test.tsx`: cover toggle defaults to disabled, enabled state passes `['FOODS','OFF']`, disabled state passes `['OFF']`, persistence under `forkcast:foods-enabled`, badge label `FOODS` instead of `BLS`, list key uses `${source}:${id}`
- [x] 12.2 Update `frontend/src/features/log-ingredient/search-panel.tsx`: rename localStorage key from `forkcast:off-enabled` to `forkcast:foods-enabled`, flip default semantics (toggle = "include FOODS"), update toggle label to "Foods", update badge rendering to `FOODS`/`OFF`, update list key prefix
- [x] 12.3 Migration helper (one-shot): on first read of `forkcast:foods-enabled`, if the legacy `forkcast:off-enabled` key exists, ignore it and remove it (single-user app, no preservation needed; test it cleans the legacy key)

## 13. Tear down BLS

- [x] 13.1 Delete `backend/src/domain/bls/` (types.ts, parse-bls-csv.ts, parse-bls-csv.test.ts, map-bls-entry.ts, map-bls-entry.test.ts)
- [x] 13.2 Delete `backend/src/domain/ingredient-search/score-bls-match.ts` and `score-bls-match.test.ts`
- [x] 13.3 Delete `backend/src/infrastructure/ingredient-search/in-memory-bls.service.ts` and `in-memory-bls.service.test.ts`
- [x] 13.4 Delete `backend/scripts/build-bls-data.ts` and the `build:bls` package.json script
- [x] 13.5 Delete `backend/data/bls.json`
- [x] 13.6 Delete `backend/BLS_4_0_Daten_2025_DE.csv` (if still present)
- [x] 13.7 Grep `bls` (case-insensitive) across `backend/`, `frontend/`, `openspec/`, `pnpm-workspace.yaml`, root `package.json` and remove any stragglers
- [x] 13.8 Update root `CLAUDE.md` if it mentions `pnpm --filter @forkcast/backend build:bls`

## 14. Verification

- [x] 14.1 Run `pnpm --filter @forkcast/backend test` — all tests pass
- [x] 14.2 Run `pnpm --filter @forkcast/frontend test` — all tests pass
- [x] 14.3 Run `pnpm --filter @forkcast/backend lint` and `pnpm --filter @forkcast/frontend lint`
- [x] 14.4 Run `pnpm dev`, open the log-ingredient search drawer, confirm: default loads OFF results only; toggling FOODS on shows curated entries first then OFF entries; closing and reopening preserves toggle state; result badges read `FOODS` and `OFF` correctly
- [x] 14.5 Smoke-test the recipe importer with a sample multi-photo recipe; confirm matched ingredients show `source: 'FOODS'` and unmatched ingredients still surface as unmatched draft rows (smoke-tested post-archive with a 2-photo "Marry Me Chickpeas" recipe; matched "Zwiebel" from FOODS with piece quantity preserved; 8 unmatched ingredients surfaced correctly. Note: existing matching limitation reproduced — substring-match fails when recipe wording is longer than canonical, e.g. "Kichererbsen (aus der Dose, abgetropft)" not auto-matched to "Kichererbsen". Pre-existing BLS-era behaviour, not a regression)
- [x] 14.6 `openspec validate replace-bls-with-curated-foods --strict` passes
