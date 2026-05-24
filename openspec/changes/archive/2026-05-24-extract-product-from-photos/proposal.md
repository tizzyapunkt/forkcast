## Why

When a scanned barcode isn't in Open Food Facts, the search panel dead-ends at "not found" with only a "Try again" button — common for local and store-brand German products (e.g. the REWE frozen-berry box that triggered this). The barcode is already known and the product name plus the nutrition table are printed on the packaging, so the existing Anthropic vision setup can extract everything needed. Capturing it once keyed by barcode means every later scan of the same product resolves instantly without re-running the AI.

## What Changes

- Replace the `barcode-not-found` dead-end with a **"Photograph packaging"** action that opens photo capture (front for the name, back for the nutrition table), reusing the recipe-import staging pattern.
- Add a backend **product extractor** over the existing Anthropic client: a forced `extract_product` tool call returns `{ name, unit (g|ml), macrosPer100: { calories, protein, carbs, fat } }` from 1+ packaging photos. Gated behind `ANTHROPIC_API_KEY` (503 `ai-import-not-configured` when unset), reusing the recipe-import image count/size limits and validation.
- Add a **review & edit step**: the extracted draft is shown in an editable form (name + per-100 macros) so AI misreads of the nutrition label can be corrected before anything is logged or saved.
- Add a **local barcode store** (`scanned-products.json`, runtime-writable, atomic-write like the recipe/weight stores). On confirm, the edited product is persisted as `{ barcode, name, unit, macrosPer100, capturedAt }` (upsert by barcode).
- Extend **barcode lookup** so it consults the local store: a stored barcode resolves locally (no AI, no OFF round-trip) and returns an `IngredientSearchResult`. The result `source` union gains `'SCAN'` so locally-captured products are visually distinct from `OFF`/`FOODS`.
- After saving, the product flows into the existing select/log path (`onSelect`) so the user can log it immediately, exactly like an OFF hit.

Out of scope: feeding captured products into the curated `foods.json` catalog (that stays build-script-owned); editing or deleting stored scanned products after the fact.

## Capabilities

### New Capabilities

- `barcode-product-capture`: when a barcode lookup misses, extract a product (name, unit, per-100 macros) from packaging photos via the AI vision setup, let the user review and edit it, persist it to a local store keyed by barcode, and resolve that barcode locally on future lookups.

### Modified Capabilities

<!-- None. The OFF/foods barcode path is extended additively via the composite search service; foods.json and curated-foods-source are untouched (captured products go to a separate store, not the curated catalog). -->

## Impact

- **New endpoints:** `POST /extract-product-from-photos` (`{ barcode, images }` → product draft; key-gated) and `POST /save-scanned-product` (`{ barcode, name, unit, macrosPer100 }` → persisted `IngredientSearchResult`).
- **Backend:** new `domain/barcode-product-capture/` (types, `ProductDraftExtractor` port, save use case) and `infrastructure/` adapters (`anthropic-product-draft-extractor.ts`, `json-scanned-products.store.ts`); `CompositeIngredientSearchService.searchByBarcode` consults the local store; `index.ts` wiring; new `backend/data/scanned-products.json`.
- **Shared type:** `IngredientSearchResult.source` union extended with `'SCAN'` (touches the OFF/foods mappers' source typing, the frontend source badge, and `SearchPanel`).
- **Frontend:** new capture/review feature folder (reusing the photo-staging + base64 patterns), changes to the `barcode-not-found` branch of `search-panel.tsx`, new API client + hook + React Query wiring, and German i18n strings.
- **Config:** reuses the existing `ai.recipeImport` image limits; no new dependencies (Anthropic SDK and `@zxing` are already present).
