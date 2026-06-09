## Context

The OFF adapter (`map-off-product.ts`) already maps nutrients exclusively from the `_100g` nutriment fields and converts them to per-gram `macrosPerUnit`. OFF additionally exposes two product-level fields the adapter does not request today: `serving_size` (display string, e.g. `"1 slice (25g)"`) and `serving_quantity` (the gram weight of one serving). The OFF API only returns fields named in the `fields=` query param, so the service currently never receives them.

On the frontend, `FullEntryConfirm` already supports an optional `defaultAmount` prop that pre-fills the gram input (used today by the recently-used flow via `lastAmount`). When no `defaultAmount` is given the input starts empty. `IngredientSearchResult` is duplicated as a hand-mirrored interface in `backend/.../ingredient-search/types.ts` and `frontend/src/domain/ingredient-search.ts` — there is no shared package or DTO layer, so both copies must be edited.

The macro calculation basis (`macrosPerUnit × amount`) is unchanged by this work; serving fields are additive metadata plus a UI default.

## Goals / Non-Goals

**Goals:**
- Surface OFF `serving_size` / `serving_quantity` on `IngredientSearchResult` as optional fields.
- Pre-fill the log-ingredient gram input with `serving_quantity` when present, with caller-supplied defaults taking precedence.
- Keep nutrient mapping strictly on the `_100g` basis.

**Non-Goals:**
- No serving-size dropdown / multi-serving selector — only a single pre-filled default value.
- No change to `MacrosPerUnit`, the per-100g conversion, or the persisted log-entry shape.
- No serving-size support for FOODS or SCAN sources (the FOODS catalog already has its own `pieces` concept; out of scope here).
- No de-duplication of the backend/frontend `IngredientSearchResult` interfaces (tracked separately).

## Decisions

**1. Add `servingSize?: string` and `servingQuantity?: number` to `IngredientSearchResult` (both copies).**
Optional fields keep the change non-breaking — existing producers (FOODS, SCAN) and consumers ignore them. Alternative considered: a nested `serving?: { size; quantity }` object — rejected as heavier than needed for two flat optional fields that mirror the OFF field names.

**2. Request `serving_size,serving_quantity` in the OFF `fields=` query, in both `searchByName` and `searchByBarcode`.**
Without adding them to `fields=` the API omits them. Both endpoints share the same `mapOffProduct` mapper, so both must request the fields for the mapping to ever see data.

**3. Extract serving fields defensively in `mapOffProduct`.**
`serving_size` is copied through when it is a non-empty string. `serving_quantity` arrives from OFF as either a number or a numeric string; map it only when it coerces to a finite, strictly positive number, otherwise leave `servingQuantity` undefined. This guards against the community-data noise the proposal calls out. Crucially, the mapper continues to read **only** `_100g` nutrients — no `_serving` nutrient field is ever consulted, even when present.

**4. Resolve the gram-input default inside `FullEntryConfirm` as `defaultAmount ?? result.servingQuantity`.**
This expresses the required precedence (caller default wins over serving quantity, which wins over empty) in one place, without threading new props through `LogIngredientDrawer`. Alternative considered: compute the default in the drawer's `handleSelect` and pass it as `defaultAmount` — rejected because the serving quantity is intrinsic to the result, so colocating the fallback with the component that owns the input keeps the drawer agnostic and avoids a second code path.

## Risks / Trade-offs

- **[OFF `serving_quantity` occasionally malformed or zero]** → The positive-finite coercion guard drops bad values to `undefined`, so the input simply falls back to empty rather than pre-filling a nonsense amount.
- **[Two hand-mirrored `IngredientSearchResult` copies drift]** → Edit both in the same change and cover the frontend default with a component test; the existing `full-entry-confirm.test.tsx` already exercises the `defaultAmount` path, so the `servingQuantity` fallback is cheap to assert.
- **[Pre-filled default could surprise users expecting a blank field]** → Acceptable: the value reflects the product's real serving and remains fully editable; it only changes the starting point, never the calculation.

## Migration Plan

Purely additive and backward-compatible. New optional fields default to absent; old cached/persisted data and the log-entry shape are unaffected. No data migration or rollback steps required — reverting the code restores prior behavior with no residue.
