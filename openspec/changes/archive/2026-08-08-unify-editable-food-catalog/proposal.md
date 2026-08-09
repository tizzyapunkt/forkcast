# Unify FOODS and USER into One Editable Food Catalog

## Why

Making a food permanent currently takes a seven-step round trip across two machines: confirm it on the phone → it lands in the write-only `user-foods.json` overlay (invisible to the picker's own search) → **Export drains the store** so a file in `~/Downloads` becomes the only copy → move it to the laptop → `build:foods:augment` has an LLM re-draft the entry you already confirmed → commit `foods.json` + `foods-seed-keys.ts` → build and deploy. Nothing in the app can fix a bad entry: a wrong macro value, a typo'd name, or an AI-invented synonym (the live overlay contains `"Ölpacked getrocknete Tomaten"`) is uneditable and undeletable until the catalog is rebuilt.

All of that complexity is downstream of one line — `backend/docker-entrypoint.sh:4` copies the image's `foods.json` over the data volume on **every** container start, so FOODS cannot be written at runtime. The overlay exists only as a workaround for that, and the draining export exists only to stop the overlay re-accumulating what was already promoted. Flip the boot rule and the entire pipeline collapses into one editable store.

## What Changes

- **One catalog.** The curated FOODS source and the USER overlay merge into a single runtime-writable catalog in the data volume, using today's `FoodEntry` shape unchanged. `'FOODS'` and `'USER'` collapse into `'CATALOG'`.
- **Seed only when absent.** On boot, an existing catalog is used as-is and never overwritten; the bundled starting point is copied in only when no catalog exists. A deploy never touches live catalog data.
- **Catalog manager screen.** List, search, create, edit, and delete entries (name, synonyms, unit, per-100 macros, pieces, untracked) from inside the app.
- **Blank create form with an optional AI fill.** Hand-adding a food starts empty; an explicit *AI ausfüllen* action fills name/unit/synonyms/macros on request. AI is never the default path for a food the user is typing in deliberately.
- **Delete is real deletion.** No hide flag, no tombstones. Deletion is safe by construction: `RecipeIngredient` and `FullIngredientEntry` store macro **snapshots** with no `foodId` back-reference, so saved recipes and logged days are unaffected.
- **Snapshot export replaces draining export.** Settings offers a full catalog snapshot download that leaves the store untouched, for backup and for optionally recommitting a fresh starting point to the repo.
- **Catalog is always searched.** The `[ ] Foods` toggle (which defaulted to *off*, so an unprimed search returned Open Food Facts products only, and never reached the user's own foods at all) is replaced by an always-on catalog plus an opt-in Open Food Facts checkbox.
- **BREAKING** — the `IngredientSearchResult.source` discriminator becomes `'CATALOG' | 'OFF' | 'SCAN'`; `'FOODS'` and `'USER'` are no longer valid values, and the `sources` query parameter accepts `catalog` in place of `foods`/`user`.
- **Deleted**: `backend/scripts/build-foods-data.ts`, `build-foods-augment*.ts`, `foods-seed-keys.ts`, the `build:foods` / `build:foods:augment` package scripts, and the draining `POST /export-user-foods`.
- **One-time migration**: the existing `user-foods.json` (confirmed foods plus learned `{foodId, synonym}` pairs) is folded into the catalog on first boot, then retired.

Explicitly out of scope: any change to the AI import extraction or review UI (that is the follow-up `show-import-match-provenance` change), multi-user or concurrent-edit handling, and per-entry provenance history.

## Capabilities

### New Capabilities

- `food-catalog`: the single runtime-editable food catalog — entry shape and validation, seed-if-absent boot, folded/tiered name search with `source: 'CATALOG'`, create/edit/delete, the catalog manager screen and its blank-plus-AI-fill create form, snapshot export, and the one-time overlay migration.

### Modified Capabilities

- `curated-foods-source`: removed in full — superseded by `food-catalog`. The immutable build-script-generated dataset, the seed-key list, and the augment/promotion pipeline cease to exist; the search, ranking, tie-break, result-shape, and badge requirements carry over to `food-catalog` restated against `CATALOG`.
- `user-foods-overlay`: removed in full — superseded by `food-catalog`. There is no separate overlay store, no `USER` source, and no export-and-clear endpoint.
- `ai-recipe-import`: the import match cascade changes from `FOODS → USER → SCAN` to `CATALOG → SCAN`, and matched draft rows carry `source: 'CATALOG'`.
- `unmatched-ingredient-resolution`: confirming a resolution writes to the catalog rather than the overlay — a `new-food` verdict appends a catalog entry, a `synonym-of` verdict adds a synonym to the target catalog entry; resolved foods remain immediately searchable.
- `ingredient-search-source-toggle`: the `sources` parameter accepts `catalog` instead of `foods`/`user`, and the SearchPanel always searches the catalog while exposing Open Food Facts as the opt-in source.
- `container-deployment`: the backend image ships a starting-point catalog that the entrypoint installs **only when the data volume has none**, replacing today's copy-on-every-start.

## Impact

- **Backend**: new catalog store and search service replacing `infrastructure/user-foods/` and the in-memory foods service; new catalog CRUD + snapshot endpoints; `confirm-resolution` retargeted; import cascade shortened; `IngredientSource` / `IngredientResultSource` narrowed; composite search rewired; startup migration from `user-foods.json`.
- **Frontend**: new catalog manager feature folder (list/search/create/edit/delete) with an AI-fill action; `UserFoodsPanel` replaced by a snapshot-export panel; `SearchPanel` source controls reworked; `source` badge values updated; new German strings.
- **Build / deploy**: `docker-entrypoint.sh` becomes seed-if-absent; three build scripts and the seed-key module deleted along with their tests; `package.json` scripts and `CLAUDE.md`'s `build:foods` line updated.
- **Data**: `backend/data/foods.json` becomes runtime-writable state seeded from the image; `backend/data/user-foods.json` is merged in once and removed. Saved recipes and log entries are untouched — they hold macro snapshots, not catalog references.
