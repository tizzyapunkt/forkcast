## 1. User-foods overlay store (backend)

- [x] 1.1 TDD `domain/user-foods`: types (`LearnedSynonym`, store shape), `UserFoodsStore` port (load, addFood, addSynonym, exportAndClear), validation reusing the curated food-entry rules
- [x] 1.2 TDD `infrastructure/user-foods/json-user-foods-store`: atomic JSON persistence at `backend/data/user-foods.json`, missing file → empty store
- [x] 1.3 TDD `InMemoryFoodsService.addSynonym` / `removeSynonyms`: runtime synonym registration on the curated index; overlay synonyms re-applied at startup; orphaned `foodId` skipped with warning

## 2. Search integration

- [x] 2.1 TDD USER source: overlay foods searchable via the shared fold/rank helpers, results `source: 'USER'`, per-unit macro derivation; new foods findable without restart
- [x] 2.2 TDD scanned-product name search in `CompositeIngredientSearchService` (active only when `SCAN` in sources set), mapped via `mapScannedProduct`
- [x] 2.3 TDD composite + `/search-ingredients` handler: source set type widened (`FOODS | USER | OFF | SCAN`), `user` identifier accepted, defaults unchanged
- [x] 2.4 TDD import matching cascade in `import-recipe-from-photos.use-case.ts`: FOODS → USER → SCAN, strict tiering, normalized-name retry wraps the full cascade, OFF never queried; debug candidates carry tier source

## 3. Shared AI tooling extraction

- [x] 3.1 Move triage/generation tool schemas, prompts, and entry validation from `backend/scripts/` into `src` (domain port `FoodResolutionProposer` + Anthropic adapter in infrastructure); scripts import from the shared module; existing script tests stay green
- [x] 3.2 TDD runtime proposer adapter: single batch call, per-item top-K (8) FOODS+USER candidates in prompt, name+note passed, model id configurable alongside the extractor config

## 4. Resolution endpoints (backend)

- [x] 4.1 TDD `propose-ingredient-resolutions` use case + handler: batch in/out, verdict shapes, invalid drafted entries degrade to per-item skip, no persistence; auth/503/502/observability mirroring AI import
- [x] 4.2 TDD `confirm-ingredient-resolution` use case + handler: persist new-food/synonym to overlay, register synonym on live index, build `MatchedDraftIngredient` by reusing the import post-match rules (unit override, pieces, untracked + displayQuantity, note), folded-name collision → 409
- [x] 4.3 TDD `export-user-foods` handler: atomic export-and-clear, learned synonyms unregistered from the live index, auth

## 5. Review-screen resolve flow (frontend)

- [x] 5.1 TDD api + React Query hooks: batch propose (prefetch on review mount when unmatched items exist), confirm mutation
- [x] 5.2 TDD unmatched panel resolve flow: per-item proposal state (loading / proposal / skip / error), editable show-and-confirm sheet (`ResolvePane` per handoff), confirmed row animates into the ingredient list with original amount/unit/note + provenance tag; manual catalog search reachable in-sheet in every state (incl. skip/loading — fix prototype dead-ends per design.md D10); row-level discard (✕) untouched; propose failure non-blocking
- [x] 5.3 TDD `USER` source badge in search-result lists
- [x] 5.4 TDD create-with-AI trigger in the shared search panel (dashed „… neu anlegen" button per handoff, ≥2-char query): single-item propose with sheet opening in loading state, AI-prefilled editable confirm (not the prototype's blank form — design.md D10), confirmed entry delivered as a normal search selection (picker add/replace + log drawer amount step), skip/failure non-blocking

## 6. Settings: overlay export replaces unmatched export

- [x] 6.1 TDD overlay export panel: pending count, export → download with timestamped filename, disabled when empty, drain warning copy; remove unmatched panel from settings

## 7. Removal of unmatched-ingredient collection

- [x] 7.1 Delete backend `domain|infrastructure|http/unmatched-ingredients`, recorder wiring + `recorder` dep in the import use case, route registration in `index.ts`; delete `backend/data/unmatched-ingredients.json`
- [x] 7.2 Delete frontend `features/unmatched-ingredients`, related api/queries/keys, MSW handlers; prune i18n strings
- [x] 7.3 Sweep tests/fixtures for recorder references; full workspace test + lint pass (no recorder/unmatched refs remain in src; backend 631 tests + frontend 452 tests green; src lint clean both workspaces; only pre-existing red is `map-off-product.test.ts` type error + `design_handoff_*` prototype-dir lint, both untouched by this change)

## 8. Augment script retarget

- [x] 8.1 TDD overlay-export ingestion: parse `{ foods, synonyms }`, reject old `{ entries }` shape with a clear error, orphaned synonyms surfaced and skipped
- [x] 8.2 TDD promotion paths: synonym additions to curated entries; food drafting via shared module with confirmed entry as hint; seed-key append; `[a]ccept/[e]dit/[s]kip` menu with accept default; `--dry-run`

## 9. Verification

- [~] 9.1 Smoke test — backend booted clean with new wiring + startup synonym re-application; authenticated round-trip verified end-to-end: confirm new-food → matched row (source USER, amount + note preserved) → persisted to overlay → immediately findable via `sources=user` search → export-and-clear drains the overlay. Frontend builds clean (no import cycle). REMAINING (needs user's `ANTHROPIC_API_KEY` + device): the Chrome browser e2e of the full photo-import → AI-propose → confirm → save → re-import flow with the live model.
