## 1. User-foods overlay store (backend)

- [ ] 1.1 TDD `domain/user-foods`: types (`LearnedSynonym`, store shape), `UserFoodsStore` port (load, addFood, addSynonym, exportAndClear), validation reusing the curated food-entry rules
- [ ] 1.2 TDD `infrastructure/user-foods/json-user-foods-store`: atomic JSON persistence at `backend/data/user-foods.json`, missing file → empty store
- [ ] 1.3 TDD `InMemoryFoodsService.addSynonym` / `removeSynonyms`: runtime synonym registration on the curated index; overlay synonyms re-applied at startup; orphaned `foodId` skipped with warning

## 2. Search integration

- [ ] 2.1 TDD USER source: overlay foods searchable via the shared fold/rank helpers, results `source: 'USER'`, per-unit macro derivation; new foods findable without restart
- [ ] 2.2 TDD scanned-product name search in `CompositeIngredientSearchService` (active only when `SCAN` in sources set), mapped via `mapScannedProduct`
- [ ] 2.3 TDD composite + `/search-ingredients` handler: source set type widened (`FOODS | USER | OFF | SCAN`), `user` identifier accepted, defaults unchanged
- [ ] 2.4 TDD import matching cascade in `import-recipe-from-photos.use-case.ts`: FOODS → USER → SCAN, strict tiering, normalized-name retry wraps the full cascade, OFF never queried; debug candidates carry tier source

## 3. Shared AI tooling extraction

- [ ] 3.1 Move triage/generation tool schemas, prompts, and entry validation from `backend/scripts/` into `src` (domain port `FoodResolutionProposer` + Anthropic adapter in infrastructure); scripts import from the shared module; existing script tests stay green
- [ ] 3.2 TDD runtime proposer adapter: single batch call, per-item top-K (8) FOODS+USER candidates in prompt, name+note passed, model id configurable alongside the extractor config

## 4. Resolution endpoints (backend)

- [ ] 4.1 TDD `propose-ingredient-resolutions` use case + handler: batch in/out, verdict shapes, invalid drafted entries degrade to per-item skip, no persistence; auth/503/502/observability mirroring AI import
- [ ] 4.2 TDD `confirm-ingredient-resolution` use case + handler: persist new-food/synonym to overlay, register synonym on live index, build `MatchedDraftIngredient` by reusing the import post-match rules (unit override, pieces, untracked + displayQuantity, note), folded-name collision → 409
- [ ] 4.3 TDD `export-user-foods` handler: atomic export-and-clear, learned synonyms unregistered from the live index, auth

## 5. Review-screen resolve flow (frontend)

- [ ] 5.1 TDD api + React Query hooks: batch propose (prefetch on review mount when unmatched items exist), confirm mutation
- [ ] 5.2 TDD unmatched panel resolve flow: per-item proposal state (loading / proposal / skip / error), editable show-and-confirm step, confirmed row moves into the ingredient list with original amount/unit/note; manual (+) and (✕) untouched; propose failure non-blocking — layout per design handoff
- [ ] 5.3 TDD `USER` source badge in search-result lists

## 6. Settings: overlay export replaces unmatched export

- [ ] 6.1 TDD overlay export panel: pending count, export → download with timestamped filename, disabled when empty, drain warning copy; remove unmatched panel from settings

## 7. Removal of unmatched-ingredient collection

- [ ] 7.1 Delete backend `domain|infrastructure|http/unmatched-ingredients`, recorder wiring + `recorder` dep in the import use case, route registration in `index.ts`; delete `backend/data/unmatched-ingredients.json`
- [ ] 7.2 Delete frontend `features/unmatched-ingredients`, related api/queries/keys, MSW handlers; prune i18n strings
- [ ] 7.3 Sweep tests/fixtures for recorder references; full workspace test + lint pass

## 8. Augment script retarget

- [ ] 8.1 TDD overlay-export ingestion: parse `{ foods, synonyms }`, reject old `{ entries }` shape with a clear error, orphaned synonyms surfaced and skipped
- [ ] 8.2 TDD promotion paths: synonym additions to curated entries; food drafting via shared module with confirmed entry as hint; seed-key append; `[a]ccept/[e]dit/[s]kip` menu with accept default; `--dry-run`

## 9. Verification

- [ ] 9.1 End-to-end smoke test (Chrome tools, HTTPS off in Vite): import a recipe photo with unmatched ingredients, resolve via AI proposals, save, re-import → previously-resolved ingredients match as `USER`; export overlay from settings and confirm drain
