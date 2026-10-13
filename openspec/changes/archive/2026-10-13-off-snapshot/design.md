# Design

## Context

See proposal.md for the motivation. Current state:

- **The demo's OFF wiring.** `buildDemoApp(documentFor, offFetch)` (`frontend/src/demo/demo-app.ts`) passes `new OpenFoodFactsService(offFetch)` to `createApp` as `openFoodFacts`. `CompositeIngredientSearchService` calls its `searchByName(query, undefined, locale)` for the OFF source. When that call rejects, the composite logs the error and returns the other sources' results. `searchByBarcode` goes to the same service.
- **Mapping and matching** are domain code and already browser-safe:
  - `mapOffProduct(product, locale?)` (`domain/ingredient-search/map-off-product.ts`) names a hit per locale (locale name, then generic, then the other locale), tidies the name, drops products without calories, and converts to per-gram macros.
  - `fold` and `matchFoodEntry({ nameFolded, synonymsFolded }, foldedQuery)` (`domain/ingredient-search/`) are the catalog's tiered matcher: exact, whole word, prefix, token start, substring. Name hits score above synonym hits.
- **Probe of search-a-licious (2026-10-13):**
  - `q=countries_tags:"en:<country>"` with `sort_by=-unique_scans_n` returns the most-scanned products sold in that country, 100 per page. The result window is capped at 10,000 (`count: 10000`).
  - Around rank 2,000 in the UK, products still have about 23 scans, and 98 of 100 carry calories.
  - The fields the mapper reads, trimmed to four nutriments, average about 225 bytes per product.
  - `unique_scans_n` counts scans worldwide; the country filter only means "sold in". OFF's per-country `popularity_tags` (`top-5000-de-scans-YYYY`) exist on products, but search-a-licious does not index them (count 0 for every tag tried).
- **Formatting.** `make fmt` runs `vp fmt` over `frontend/src`, and the root `vite.config.ts` `fmt` block has no ignore list. A large JSON under `src/` would be pretty-printed.

## Goals / Non-Goals

**Goals:**

- In the demo, OFF name search answers from a bundled snapshot. Names, labels and macros come out the same way as live OFF results, because the same mapper produces them.
- Building the snapshot is one repeatable command. Deploys and tests never touch OFF.
- The snapshot costs nothing until a visitor actually searches OFF.

**Non-Goals:**

- Changing the self-hosted server. It keeps calling OFF live.
- A per-country popularity ranking beyond what search-a-licious offers (see Context).
- Offline barcode lookup. Barcodes stay live, since that endpoint allows CORS.
- Refreshing the snapshot in CI.

## Decisions

### 1. The snapshot stores raw OFF fields, and the demo maps them at query time

Each entry is the subset of the OFF product the mapper reads:

- `code`;
- `product_name`, `product_name_de`, `product_name_en`;
- `brands`;
- `serving_size`, `serving_quantity`;
- `nutriments`, with `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g` and `fat_100g` only.

Entries are ordered by scan count, most scanned first. The file is an object:

```json
{ "source": "…", "license": "ODbL-1.0 …", "builtAt": "…", "countries": [], "products": [] }
```

So the licence and provenance travel with the data.

*Why raw fields over pre-mapped results:* `mapOffProduct(product, locale)` then names each hit in the visitor's locale, exactly as live search does. Any later change to the mapper applies to the snapshot without a rebuild.

### 2. The build script pages per country and dedupes

`scripts/demo/build-off-snapshot.mts` queries search-a-licious for each of `en:germany`, `en:united-kingdom` and `en:united-states`:

- `q=countries_tags:"<country>"`, `sort_by=-unique_scans_n`, `page_size=100`, `langs=en,de`, and the fields above plus `unique_scans_n`;
- pages 1–20 per country (2,000 products each), with about 1 s between requests (about 60 requests, about a minute);
- the same `User-Agent` convention as the SDK, since it runs in Node.

It then:

1. drops products whose `energy-kcal_100g` is missing, and products `mapOffProduct` would reject (no name in any of the three fields);
2. dedupes by `code`, keeping the highest `unique_scans_n`;
3. sorts by `unique_scans_n` descending, then strips that field;
4. writes `frontend/src/demo/off-snapshot.json` as compact JSON, then prints per-country counts and the file size.

It runs on Node 24 with `--experimental-transform-types` and imports `mapOffProduct` from the backend source, so "would the mapper keep it" is decided by the real code.

*Alternative:* searching OFF for every catalog food name. More requests and slower, and the user preferred popularity.

### 3. `SnapshotOffSearch` replaces the live OFF service in the demo, for name search only

`frontend/src/demo/snapshot-off-search.ts` implements `IngredientSearchService`.

- **Constructor.** It takes a `load: () => Promise<OffSnapshot>` and a `barcode` service (the existing `OpenFoodFactsService(demoOffFetch)`).
- **`searchByName(query, _sources, locale = 'de')`:**
  - It awaits `load()` once and memoizes it.
  - It folds the query, and returns nothing below two characters, as the scanned-products search does.
  - For each product it builds `{ nameFolded: fold(<the locale's display name>), synonymsFolded: [other name fields, each brand] }` and scores it with `matchFoodEntry`. The display name is `mapOffProduct(product, locale)?.name`.
  - It keeps only products whose names and brands contain every word of the query, as a live OFF search does. The catalog matcher alone also scores a short name that occurs *inside* the query, so a plain "Butter" would outrank peanut butters for `peanut butter`.
  - It keeps hits with a score above 0 and sorts by score, then snapshot order (popularity). It returns the top 20 mapped through `mapOffProduct(product, locale)`. That is the same cap as live OFF (`page_size: 20`).
  - The folded index is built once per locale on first use and cached, so later keystrokes don't re-fold 6,000 names.
- **`searchByBarcode(code)`** delegates to the live service.

`buildDemoApp` takes the OFF service instead of an `offFetch`. `startDemo` builds the snapshot search with `load: () => import('./off-snapshot.json').then((m) => m.default)`. Vite emits that as a separate chunk loaded on first use. Tests pass an in-memory snapshot.

*Alternative:* mapping all products into catalog-shaped entries and reusing `CatalogSearchService`. Rejected: the catalog has a different shape (units, pieces, synonyms per entry), and the OFF source must stay labelled OFF.

### 4. Formatting and size

The root `vite.config.ts` `fmt` block gains `ignorePatterns: ['frontend/src/demo/off-snapshot.json']`, so `make fmt` never pretty-prints the generated file. If `vp fmt` does not honour that key, the fallback is to write the file outside `frontend/src` (`frontend/demo-data/`) and import it from there.

The chunk is about 1.3 MB raw and about 300 KB gzipped. Only the demo loads it, and only on the first OFF search.

### 5. Attribution and privacy copy

- **The intro.** The demo intro gains one line: "Product search uses a snapshot of Open Food Facts (ODbL)" / "Die Produktsuche nutzt einen Schnappschuss von Open Food Facts (ODbL)", with links to openfoodfacts.org and the ODbL. The banner stays as it is.
- **The privacy pages.** In EN and DE, the demo section's second paragraph says that searches stay in the browser and that only barcode lookups go to Open Food Facts.

## Risks / Trade-offs

- [Worldwide scan counts rank some products that are rarely bought in a given country, such as Spanish-named biscuits listed as sold in Germany] → Accepted. The country filter keeps the products relevant, and match quality ranks before popularity.
- [The snapshot ages] → The file carries its `builtAt` date, and the script reruns in about a minute. A stale snapshot only means a few products are missing.
- [About 1.3 MB per refresh in git history] → Refresh rarely, for example before a launch.
- [A first OFF search waits for the chunk on a slow phone connection] → About 300 KB gzipped, loaded once. Until then the search behaves like any slow OFF search.
- [ODbL share-alike: the snapshot is a derived database] → It is published openly in the repo with its licence and source, which satisfies share-alike. The intro gives the attribution.

## Migration Plan

- **Deploy.** Merge, and the website workflow redeploys the demo (the trigger paths cover `frontend/**` and `scripts/demo/**`).
- **Rollback.** Revert the commit; the demo goes back to live OFF name search, which is blocked by CORS.
