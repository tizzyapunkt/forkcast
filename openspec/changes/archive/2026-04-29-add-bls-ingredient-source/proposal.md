## Why

Open Food Facts is fine for packaged goods, but it has weak coverage for unprocessed/raw foods (single-ingredient items like "Karotte, roh", "Hähnchenbrust, roh", "Haferflocken") — exactly the things the user actually cooks with. The German national food composition database **BLS 4.0 (2025)** fills that gap with ~7,000 well-curated raw and minimally processed foods, all with German names. Adding BLS as a second ingredient source closes the most painful "I can't find this food" hole in logging today, and does so in German, which is the user's working language.

A heavyweight solution (Postgres + tsvector) is not warranted at this stage — we don't yet know if the feature delivers enough value to justify a database engine. The MVP keeps the JSON-file persistence model and proves the value first.

## What Changes

- New BLS ingredient source: a build-time step extracts a small subset of columns from `BLS_4_0_Daten_2025_DE.csv` (already in the repo) into a compact JSON file shipped with the backend.
- New in-memory BLS search adapter: loads the JSON at boot, performs case- and diacritic-insensitive substring matching against German + English food names.
- **BREAKING (search domain only)**: `IngredientSearchResult` gets a `source: 'OFF' | 'BLS'` discriminator, and `offId` is renamed to a generic `id`. No persisted data carries `offId` (log entries denormalize macros at log time), so this is a non-breaking change at the storage layer.
- Search aggregation: name search queries OFF (network) and BLS (in-memory) in parallel and returns a merged list. BLS results first, then OFF. Barcode search continues to query OFF only.
- Frontend renders a small `BLS` / `OFF` badge next to each search result, and uses `${source}:${id}` as the React list key.
- No new database, no postgres, no tsvector. JSON-file persistence stays.

## Capabilities

### New Capabilities
- `bls-ingredient-source`: load and serve raw/unprocessed German foods from the BLS 4.0 dataset as a searchable in-memory ingredient source, with case- and diacritic-insensitive name matching.

### Modified Capabilities
<!-- The current `ingredient-search` capability has no published spec under openspec/specs/.
     The cross-source aggregation (merging BLS + OFF) and the source attribution badge are new behaviors,
     and they are documented inside the new `bls-ingredient-source` capability spec
     (and design.md), since there is no existing spec to delta against. -->

## Impact

- **Backend**
  - New `backend/scripts/build-bls-data.ts` build script: parses `BLS_4_0_Daten_2025_DE.csv`, keeps only `BLS Code`, `Lebensmittelbezeichnung`, `Food name`, `ENERCC` (kcal/100g), `PROT625`, `FAT`, `CHO`; drops rows without calories; writes `backend/data/bls.json`.
  - New domain folder `backend/src/domain/bls/` (types + `BlsRepository` port + `mapBlsRow` mapper).
  - New infrastructure adapter `backend/src/infrastructure/ingredient-search/in-memory-bls.service.ts` implementing `IngredientSearchService.searchByName` (BLS has no barcodes — `searchByBarcode` returns null).
  - New aggregator `backend/src/infrastructure/ingredient-search/composite-ingredient-search.service.ts` that fans out to OFF + BLS, merges results, and tags each with `source`.
  - **Modify** `backend/src/domain/ingredient-search/types.ts`: rename `offId` → `id`, add `source: 'OFF' | 'BLS'`. Update `mapOffProduct` to set `source: 'OFF'`.
  - Update `backend/src/index.ts` to wire the composite service into `/ingredients/search` and the BLS service into `bootstrap`.
  - New small CSV parsing helper (no external dep — semicolon split is enough for this dataset; we'll handle the `\r\n` line endings and BOM).
  - New diacritic-folding helper (`Käse → kase`) for both query and indexed names.
- **Frontend**
  - **Modify** `frontend/src/domain/ingredient-search.ts`: rename `offId` → `id`, add `source` field.
  - **Modify** `frontend/src/features/log-ingredient/search-panel.tsx`: list keys become `${source}:${id}`, render a small `BLS`/`OFF` badge per result row.
  - **Modify** any other consumer (recipe ingredient picker) that keys on `offId`.
  - Update MSW fixtures + tests to cover both sources and the badge.
- **Data**
  - The 1.7 MB CSV stays in the repo at the root. The generated `bls.json` is committed (small, deterministic, frees boot from CSV parsing).
- **No DB, no Docker, no new runtime deps.** csv parsing is a few lines in plain TypeScript.
- **No breaking API changes** in the HTTP layer for existing clients beyond the `offId → id` + `source` field added to `/ingredients/search` results.
