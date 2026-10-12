# Proposal

## Why

Open Food Facts name search is hard-coded to German products in German (`lang:de countries_tags:"en:germany"`). Anyone outside Germany, which is most of a Show HN audience and every user of the English UI, gets German products or nothing when they search for packaged food. The website says Open Food Facts "has had almost everything I searched for"; that holds only in Germany.

## What Changes

- The OFF name search drops the country filter and searches in the active UI locale's language (`langs` = `de` or `en`), so products from every country can match.
- The backend passes the search request's `locale` through to the OFF adapter (today only the catalog uses it).
- OFF results are named in the active locale when OFF has a name in that language (`product_name_en` / `product_name_de`), falling back to the generic `product_name`.
- Barcode lookup is unchanged; it already works worldwide.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-locale`: "Ingredient search requests carry the active locale" extends to Open Food Facts: the OFF search uses the active locale's language, has no country restriction, and names results in that language when available.

## Impact

- `backend/src/infrastructure/ingredient-search/open-food-facts.service.ts` (query, fields, locale parameter), `composite-ingredient-search.service.ts` (pass locale to OFF), `domain/ingredient-search/map-off-product.ts` (locale-aware name), the `IngredientSearchService` port signature if needed.
- German users may see more non-German products in OFF results; accepted.
- The browser demo (`browser-demo`) relies on this, since it runs in English for most visitors.
