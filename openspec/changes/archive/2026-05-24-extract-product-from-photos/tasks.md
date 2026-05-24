## 1. Shared image decode/validation

- [x] 1.1 Write failing tests for a pure `decodeImagePayloads(images, limits)` helper covering: empty array, too-many, per-image `413` with `imageIndex`, total `413`, unsupported `mediaType` `400` with index, invalid base64, empty decoded image, and the happy path
- [x] 1.2 Implement `backend/src/http/ai-images/decode-image-payloads.ts` returning either `{ ok: true, images }` or `{ ok: false, status, body }`, matching the existing recipe-handler error shapes verbatim
- [x] 1.3 Refactor `import-recipe-from-photos.handler.ts` to use the shared helper; confirm its existing endpoint tests still pass unchanged

## 2. Scanned-products store (local barcode persistence)

- [x] 2.1 Add domain types `ScannedProduct` (`barcode`, `name`, `unit: 'g'|'ml'`, `macrosPer100`, `capturedAt`) and port `ScannedProductStore { findByBarcode; upsert }` under `backend/src/domain/barcode-product-capture/`
- [x] 2.2 Write failing tests for `JsonScannedProductStore`: loads missing file as empty, validates+skips bad entries on load, `upsert` writes atomically with 2-space JSON, upsert overwrites by barcode, `findByBarcode` returns stored/null
- [x] 2.3 Implement `backend/src/infrastructure/scanned-products/json-scanned-products.store.ts` mirroring the other JSON-store adapters (load on `init`/bootstrap, atomic `writeFile`)
- [x] 2.4 Write a failing test for `mapScannedProduct(p)` → `IngredientSearchResult` (`id = barcode`, `source: 'SCAN'`, `macrosPerUnit = macrosPer100 / 100`); implement it

## 3. Widen the result source union to `SCAN`

- [x] 3.1 Change `IngredientSearchResult.source` to `'FOODS' | 'OFF' | 'SCAN'` in `backend/src/domain/ingredient-search/types.ts` (leave `IngredientSource` as `FOODS|OFF`); fix any resulting type errors
- [x] 3.2 Mirror the union widening in the frontend domain type and confirm the source badge in `search-panel.tsx` renders `SCAN`

## 4. Barcode resolution: local store before OFF

- [x] 4.1 Write a failing test for `CompositeIngredientSearchService.searchByBarcode`: store hit returns `SCAN` result and OFF is NOT called; store miss falls back to OFF; both empty → `null`
- [x] 4.2 Add the store as an optional third constructor dependency and implement local-first resolution in `searchByBarcode` (leave `searchByName` unchanged)

## 5. Product extractor (AI adapter)

- [x] 5.1 Define the `extract_product` tool schema + system prompt (name from front, transcribe per-100 column, unit from "pro 100 g/ml", never invent) in `backend/src/infrastructure/barcode-product-capture/extract-product-tool.ts`
- [x] 5.2 Write failing tests for `parseProductToolInput`: rejects blank name / unit ∉ {g,ml} / non-finite or negative calories; defaults missing protein/carbs/fat to 0; accepts a valid payload
- [x] 5.3 Add domain port `ProductDraftExtractor { extract(images): Promise<ExtractedProduct> }` and `ExtractedProduct` type
- [x] 5.4 Write failing tests for `AnthropicProductDraftExtractor` with a fake `AnthropicLikeClient`: forced tool call, parses tool_use block, throws `ProductDraftExtractionError` on API failure / missing tool block / parse failure, logs `model`/`imageCount`/token counts/`durationMs` without bytes, barcode, or name
- [x] 5.5 Implement `AnthropicProductDraftExtractor` reusing the `AnthropicLikeClient` interface

## 6. Use cases

- [x] 6.1 Write failing tests for `extractProductFromPhotos({ extractor }, { barcode, images })`: rejects empty/whitespace barcode, rejects empty images, attaches pass-through barcode to the extractor output, persists nothing
- [x] 6.2 Implement the extract use case in `backend/src/domain/barcode-product-capture/extract-product-from-photos.use-case.ts`
- [x] 6.3 Write failing tests for `saveScannedProduct(store, payload)`: validates payload (barcode/name/unit/macros), upserts, returns the mapped `SCAN` `IngredientSearchResult`
- [x] 6.4 Implement the save use case in `backend/src/domain/barcode-product-capture/save-scanned-product.use-case.ts`

## 7. HTTP layer

- [x] 7.1 Write failing handler tests for `POST /extract-product-from-photos`: `400` missing barcode (no AI call), `400` empty/too-many images, `413`/`400` image limits via shared helper, `200` draft happy path, `502` on extractor error, plus the unconfigured `503 ai-import-not-configured` handler
- [x] 7.2 Implement `makeExtractProductFromPhotosHandler` + `makeUnconfiguredExtractProductFromPhotosHandler` in `backend/src/http/barcode-product-capture/`
- [x] 7.3 Write failing handler tests for `POST /save-scanned-product`: `400` invalid payload (store untouched), `200`/`201` returns `SCAN` result, upsert overwrites
- [x] 7.4 Implement `makeSaveScannedProductHandler`

## 8. Wiring

- [x] 8.1 Construct `JsonScannedProductStore('./data/scanned-products.json')`, register it in `bootstrap([...])`, and pass it as the third arg to `CompositeIngredientSearchService` in `backend/src/index.ts`
- [x] 8.2 Register `POST /save-scanned-product` (always) and `POST /extract-product-from-photos` behind the existing `config.ai.anthropicApiKey` branch (configured → real handler with `config.ai.recipeImport` limits; else `503` handler), updating the startup warning text
- [x] 8.3 Seed `backend/data/scanned-products.json` with `[]` (data files are committed, not gitignored, in this repo — matches the other runtime stores)

## 9. Frontend capture → review → log flow

- [x] 9.1 Add API clients `frontend/src/api/extract-product-from-photos.ts` and `save-scanned-product.ts`, plus a React Query mutation hook, reusing the base64 conversion pattern
- [x] 9.2 Build the `extract-product-from-photos` feature: photo staging (reuse the existing staging primitives) and an editable review form (name, unit, calories/protein/carbs/fat per 100)
- [x] 9.3 Write failing component tests (RTL + MSW) for the `search-panel.tsx` flow: not-found → "Photograph packaging" → extract → review form shows editable fields → confirm saves edited values → result handed to `onSelect`; capture entry hidden on `503 ai-import-not-configured`
- [x] 9.4 Extend the `barcode-not-found` branch of `search-panel.tsx` with the capture/extract/review/save state machine and wire it to `onSelect`
- [x] 9.5 Add the German i18n strings (capture CTA, extracting, review labels, not-configured hint) to `frontend/src/i18n/de`

## 10. Verification

- [x] 10.1 Run backend + frontend test suites; ensure all new tests pass and the refactored recipe handler is still green — backend 539/539, frontend 378/378. (Pre-existing, unrelated: `tsc` flags `pieceAmount` excess-prop in `import-recipe-from-photos.use-case.test.ts:831`, present on `main`; not introduced here.)
- [x] 10.2 Run oxlint + oxfmt across backend and frontend — both lint clean (0 errors), both formatted.
- [x] 10.3 Smoke-tested the full flow against the live server. Real Claude vision extraction on `food1–3.jpeg` returned `{name: "Himbeer-Heidelbeer-Mix", unit: "g", macrosPer100: {calories:54, protein:1, carbs:8.4, fat:0.7}}` — matches the label; extract persisted nothing; observability log clean. Also verified save → barcode resolves locally as `SCAN`, unknown barcode → 404 OFF fallback, and 503 when AI unconfigured. (Physical on-device camera capture is a manual device interaction; the component flow itself is covered by the RTL test.)
