## Why

Open Food Facts products carry a meaningful per-package serving size (e.g. "1 slice (25g)"), but forkcast ignores it: when a user picks an OFF result the gram input starts empty, forcing them to know and type the amount. Pre-filling the input with the product's serving weight removes that friction for the most common case — logging one serving of a packaged product.

## What Changes

- The OFF adapter SHALL request and map the product-level `serving_size` (string) and `serving_quantity` (gram value of one serving) fields from the OFF API.
- Nutrient mapping SHALL continue to read exclusively from the `_100g` nutriment fields; the community-contributed `_serving` nutrient variants MUST NOT be used.
- `IngredientSearchResult` gains two optional fields, `servingSize?: string` and `servingQuantity?: number`, mirrored in the frontend domain type. The macro calculation basis is unchanged — totals are still derived from `macrosPerUnit` (per-100g ÷ 100).
- In the log-ingredient confirm flow, when a selected result carries `servingQuantity`, the gram input SHALL be pre-filled with that value instead of starting empty.

## Capabilities

### New Capabilities
- `ingredient-serving-size`: Open Food Facts results carry their product serving size/quantity, and the log-ingredient gram input pre-fills with the serving weight when available — without altering the per-100g macro calculation basis.

### Modified Capabilities
<!-- none — no existing spec owns the OFF result shape or the log-ingredient gram-input default -->

## Impact

- **Backend:** `open-food-facts.service.ts` (query fields), `map-off-product.ts` (extract serving fields, guard against `_serving` nutrients), `ingredient-search/types.ts` (`IngredientSearchResult`), and their tests.
- **Frontend:** `domain/meal-log.ts` / ingredient-search domain type (mirror optional fields), `log-ingredient/full-entry-confirm.tsx` and `log-ingredient-drawer.tsx` (serving-quantity default), and their tests.
- **No domain-model change:** `MacrosPerUnit` and the per-100g conversion are untouched; serving fields are purely additive metadata + a UI default.
- **No API contract break:** the new fields are optional; existing results without serving data behave exactly as before.
