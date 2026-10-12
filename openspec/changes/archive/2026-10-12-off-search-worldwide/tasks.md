# Tasks

## 1. Locale-aware naming

- [x] 1.1 Write failing `map-off-product.test.ts` cases for the naming order in design decision 3: `en` prefers `product_name_en` over a differing generic name (`Compote` / `Skyr Pur`); `de` prefers `product_name_de`; a missing locale name falls back to the generic name, then the other locale; no locale keeps generic-first; a product with only `product_name_en` is kept; a product with no name at all is dropped. Then give `mapOffProduct` an optional `locale` until they pass, with the existing tidy-name and macro tests unchanged

## 2. Search in the active language, worldwide

- [x] 2.1 Change the OFF adapter test "queries search-a-licious with German language and market filters" to the new contract: `q` is the bare query, `langs` is the locale (`en` when passed, `de` by default), `fields` adds `product_name_en`. Then update `OpenFoodFactsService.searchByName(query, _sources?, locale = 'de')` to send that and map hits with the locale until the adapter tests pass
- [x] 2.2 Add a composite test that an `OFF` search with locale `en` calls the OFF source with `en`, then pass `locale` through in `CompositeIngredientSearchService` and update the port's doc comment; verify the composite and search-handler tests pass

## 3. Integration check

- [x] 3.1 Run `make check` and verify it passes
- [x] 3.2 Boot the backend on a scratch copy of the data directory and call `GET /search-ingredients?q=peanut%20butter&sources=catalog,off&locale=en` and `?q=Erdnussbutter&sources=catalog,off&locale=de`; verify the English search returns OFF products sold outside Germany with English names, the German one returns German-named products, and catalog results still come first

## Workflow follow-up

- Archive the change after review; archiving syncs the `ui-locale` delta.
