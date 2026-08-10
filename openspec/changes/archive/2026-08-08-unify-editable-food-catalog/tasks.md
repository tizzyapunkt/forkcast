## 1. Catalog store and entry validation (backend)

- [x] 1.1 TDD catalog entry validation: canonical name/synonyms rules (canonical name not in synonyms, case-insensitive), unit `g|ml`, finite non-negative macros, untracked-implies-zero-macros, unique piece labels with positive grams, kebab-case ascii `id`, `id` unique within the catalog
- [x] 1.2 TDD `JsonCatalogStore`: load from `<dataDir>/catalog.json`, skip invalid entries with a single warning naming the `id`, backend still starts; atomic write (temp file + rename), no torn state
- [x] 1.3 TDD store mutations: `add` (rejects duplicate id), `update` (404 on unknown id, revalidates), `remove` (404 on unknown id); every mutation persists atomically and is readable back
- [x] 1.4 TDD name-slug helper: fold + ASCII kebab-case slug derived from a canonical name (`Möhre` → `moehre`, `Getrocknete Tomaten in Öl` → `getrocknete-tomaten-in-oel`)

## 2. Seed-if-absent boot and one-time migration

- [x] 2.1 TDD seed installation at application boot: seed path injected as config; catalog file absent → seed installed and served; catalog file present → left byte-identical (this is the data-loss guard, cover it explicitly); catalog present but an empty array → left alone, not re-seeded
- [x] 2.2 TDD missing seed with no existing catalog → clear startup error naming the expected seed path (not a silently empty catalog)
- [x] 2.3 TDD one-time overlay migration: `user-foods.json` present → foods appended (id collision skipped with warning), `{foodId, synonym}` pairs merged into the target entry's `synonyms` deduped case-insensitively (orphan skipped with warning), catalog written atomically, legacy file deleted
- [x] 2.4 TDD migration idempotence: legacy file absent → no-op; re-running the merge over already-merged content produces no duplicate entries or synonyms
- [x] 2.5 `git mv backend/data/foods.json backend/data/catalog.json`; wire the runtime path and the seed path in `backend/src/index.ts`

## 3. Catalog search and source narrowing

- [x] 3.1 TDD `CatalogSearchService`: folding (case/diacritic), canonical-over-synonym tiering, tie-break by name length then `localeCompare`, 20-result cap, `source: 'CATALOG'`, per-100 → per-unit macro derivation, `untracked` pass-through — port the existing FOODS scorer tests
- [x] 3.2 TDD index rebuild on write: an added/updated/removed entry is reflected in the next search without restart; a synonym added via update is matchable immediately
- [x] 3.3 Narrow `IngredientSource` / `IngredientResultSource` to `'CATALOG' | 'OFF' | 'SCAN'` in backend and frontend; fix every resulting type error (this is the intended breaking surface)
- [x] 3.4 TDD composite search: only queries providers in the `sources` set; absent `sources` defaults to `new Set(['CATALOG'])`; SCAN name search unchanged; delete the user-foods search service
- [x] 3.5 TDD `GET /search-ingredients` `sources` parsing: accepts `catalog`/`off`/`scan`, defaults to `['catalog']` when absent or empty, silently ignores unknown values including the retired `foods` and `user`

## 4. Import and resolution retargeting

- [x] 4.1 TDD import match cascade shortened to `CATALOG → SCAN`: catalog hit wins without consulting SCAN, SCAN used only on zero catalog candidates, OFF never queried, matched rows carry `source: 'CATALOG'`; all existing unit-override / piece / untracked / note rules still pass
- [x] 4.2 TDD `confirm-ingredient-resolution` retargeted to the catalog: `new-food` appends a catalog entry and returns a row with `source: 'CATALOG'`; `synonym` adds to the target entry's `synonyms` and is immediately matchable; `409` on folded-name or id collision; new `404` when `synonym`'s `foodId` is absent; nothing persisted on either error
- [x] 4.3 Delete `backend/src/infrastructure/user-foods/` and the overlay port/types; remove the two-step "persist + register on live index" path in favour of the store's rebuild

## 5. Catalog API

- [x] 5.1 TDD `GET /catalog`: returns the full unranked entry list; `401` unauthenticated
- [x] 5.2 TDD `POST /add-catalog-entry` / `POST /update-catalog-entry` / `POST /remove-catalog-entry`: validation `400` leaves the store unchanged, duplicate id `400`, unknown id `404`, `401` unauthenticated, accepted writes are durable and immediately searchable
- [x] 5.3 TDD `GET /export-catalog`: returns the full catalog, does **not** mutate it, repeat export returns identical content, `401` unauthenticated
- [x] 5.4 TDD `POST /draft-catalog-entry`: takes `{ name }`, returns one candidate entry (unit, synonyms, per-100 macros) via the shared drafting module; mirrors the resolve flow's AI error and not-configured semantics
- [x] 5.5 Delete `POST /export-user-foods` and its handler/tests

## 6. Frontend — search surfaces

- [x] 6.1 TDD `searchIngredients` client + `useSearchIngredients` key: `sources` typed `'CATALOG' | 'OFF' | 'SCAN'`, forwarded lowercased, omitted when absent, query key includes the source set
- [x] 6.2 TDD `SearchPanel`: catalog always searched with no control to disable it; Open Food Facts toggle defaults off and persists; passes `['CATALOG']` / `['CATALOG','OFF']`; the retired `forkcast:foods-enabled` key is cleared on mount and does not affect sources
- [x] 6.3 TDD source badge: single `CATALOG` variant replaces `FOODS`/`USER`; `${source}:${id}` list key retained

## 7. Frontend — catalog manager

- [x] 7.1 TDD catalog list: entries with canonical name, unit, per-100 kcal; client-side filter over name and synonyms; reachable from settings
- [x] 7.2 TDD entry editor: name, synonyms, unit, four per-100 macros, untracked flag, piece weights; inline validation errors preserve in-progress input (cover untracked-with-non-zero-macros)
- [x] 7.3 TDD delete: explicit confirmation required, dismissing leaves the entry in place, confirming removes it from the list and from search
- [x] 7.4 TDD create form: opens with empty fields and fires no AI request on open; saves a fully hand-typed entry without ever invoking the fill
- [x] 7.5 TDD *AI ausfüllen* action: populates unit/synonyms/macros from `POST /draft-catalog-entry`, marks filled macros as estimates (reuse the `NewFoodEditor` affordance), all fields remain editable, a failed request shows an error and leaves typed input intact
- [x] 7.6 TDD duplicate-name create: surfaces the existing entry and offers to open it for editing instead of creating a second one

## 8. Frontend — settings and i18n

- [x] 8.1 TDD settings panel replacing `UserFoodsPanel`: shows total catalog entry count, links into the catalog manager, offers a snapshot download with a timestamped filename; copy states the snapshot is for backup and fresh installs and does **not** drain the catalog
- [x] 8.2 Add German strings for the catalog manager, editor, delete confirmation, fill action, and settings panel under a new `de.catalog` namespace; remove the retired `de.userFoods` strings

## 9. Retire the build pipeline and fix deployment

- [x] 9.1 Delete `backend/scripts/build-foods-data.ts`, `build-foods-helpers.ts`, `build-foods-augment.ts`, `build-foods-augment-helpers.ts`, `build-foods-augment-overlay.ts`, `foods-seed-keys.ts` and all their tests; remove the `build:foods` and `build:foods:augment` package scripts
- [x] 9.2 `docker-entrypoint.sh`: remove the unconditional `cp` (seeding now happens at application boot); `backend/Dockerfile`: ship `backend/data/catalog.json` as `/app/backend/catalog.seed.json` outside the data volume
- [x] 9.3 Remove the `pnpm --filter @forkcast/backend build:foods` line from `CLAUDE.md`

## 10. Spec purposes and docs

- [x] 10.1 Edit `openspec/specs/ingredient-search-source-toggle/spec.md` Purpose directly (deltas cannot change Purpose): describe the catalog as always-on and Open Food Facts as the opt-in source
- [x] 10.2 Edit `openspec/specs/container-deployment/spec.md` Purpose directly: the image bundles a starting-point catalog installed only when the data volume has none

## 11. Verify

- [x] 11.1 `make check` green (lint + typecheck + fmt-check + tests, both workspaces) with no new warnings
- [x] 11.2 Migration rehearsal against a copy of the real data: `foods.json` + `user-foods.json` in, merged `catalog.json` out, `balsamicoessig` and `getrocknete-tomaten-in-oel` present as entries, `cherrytomate` carrying `Kirschtomaten` and `olive-gruen` carrying `grüne Oliven`, legacy file gone
- [x] 11.3 Restart-safety rehearsal: boot twice against the same data directory and assert the catalog is byte-identical after the second boot
- [x] 11.4 Browser smoke via `make dev-http`: search a previously confirmed food in the recipe picker and see it with the `CATALOG` badge; correct an entry's macros in the manager and see the corrected value in search; delete an entry and confirm an existing recipe that used it is unchanged; export a snapshot and confirm the catalog still lists the same count
- [x] 11.5 Export a snapshot and commit it as `backend/data/catalog.json` so the repo's starting point reflects the merged catalog
