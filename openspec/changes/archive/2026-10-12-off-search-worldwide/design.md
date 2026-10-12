# Design

## Context

See proposal.md for the motivation. Current state:

- **The query.** `OpenFoodFactsService.searchByName(query)` sends `q = "<query> lang:de countries_tags:\"en:germany\""` and `langs=de` to search-a-licious, with the fields `code,product_name,product_name_de,brands,serving_size,serving_quantity,nutriments`.
- **The locale is dropped.** `CompositeIngredientSearchService.searchByName(query, sources, locale)` passes `locale` to the catalog only and calls `this.off.searchByName(query)` without it. The frontend already sends `locale` on every search (`ui-locale`), and the port already has the optional `locale` parameter.
- **Naming.** `mapOffProduct` names a product `product_name || product_name_de` and drops it when both are missing. The barcode path (`getProductV2`) uses the same mapper.
- **A probe of the live API on 2026-10-12** showed:
  - `q=peanut butter&langs=en` with no filters returns US, UK and NZ peanut butters.
  - `q=Erdnussbutter&langs=de` returns German and Austrian products.
  - `q=skyr&langs=en` shows two naming problems. One hit's generic `product_name` is `Compote` while `product_name_en` is `Skyr Pur`. Another hit has no `product_name` at all, only `product_name_en`, so today's mapper would drop it.

## Goals / Non-Goals

**Goals:**

- OFF name search works outside Germany and in the UI's language (spec delta in `specs/ui-locale/spec.md`).
- Results carry the best name for the active locale, and products named only in that locale are no longer lost.

**Non-Goals:**

- Barcode lookup. It already works worldwide, and its port method has no locale. Its naming order stays generic first, then German, plus an English fallback, so a product named only in English is kept instead of dropped.
- Ranking or boosting by country, or a user-chosen market setting.
- Locales beyond `de` and `en`.

## Decisions

### 1. The query is the user's text alone; the language goes in `langs`

Send `q = <query>` and `langs = <locale>`, with no `lang:` and no `countries_tags:` clauses. In the probe, `langs` already decides which language's fields get searched and returned. Adding `lang:en` to `q` changed nothing. Dropping both clauses keeps the query free of syntax, so the user's text can't break it.

*Alternative considered:* keep a `lang:<locale>` filter in `q`. That would drop products whose main language differs but which have a name in the active locale, such as the `fr` Skyr with an English name in the probe. Rejected.

### 2. The OFF adapter takes the locale, and the composite passes it

`OpenFoodFactsService.searchByName(query, _sources?, locale = 'de')`, the same optional third parameter the port already declares. `CompositeIngredientSearchService` passes `locale` to OFF as it does to the catalog. The port's doc comment then says the locale names catalog and OFF results. When there's no locale it stays German, matching the catalog's default.

### 3. Naming order: active locale, then generic, then the other locale

The mapper gets an optional `locale`. The order of fields:

| Locale | Order |
|---|---|
| `en` | `product_name_en`, `product_name`, `product_name_de` |
| `de` | `product_name_de`, `product_name`, `product_name_en` |
| absent (barcode) | `product_name`, `product_name_de`, `product_name_en` |

The first non-blank field wins and is then tidied as today (sentence case for shouted or all-lowercase names). If none has a value, the product is dropped. The search asks for `product_name_en` in `fields` as well.

*Alternative considered:* always generic first. In the probe that names a skyr `Compote` for an English user, and the locale-specific field exists precisely for this. Rejected.

## Risks / Trade-offs

- [German users see more non-German products, for example Austrian or Swiss] → Accepted when the proposal was written. Catalog results still come first, and OFF is opt-in per search panel.
- [`langs=en` with a query in German (or the other way round) finds less] → That's how search-a-licious works. Users type in their UI language, and the catalog matches both languages anyway.
- [Results are less local for a German user, so the product they own might rank lower] → If that turns out to matter, add a country boost later. That's a separate decision, not taken here.

## Migration Plan

None. No stored data changes, and only the request to OFF changes. Rollback means reverting the commit.
