## 1. Backend — result shape

- [x] 1.1 Add optional `servingSize?: string` and `servingQuantity?: number` to `IngredientSearchResult` in `backend/src/domain/ingredient-search/types.ts`

## 2. Backend — OFF mapping (TDD)

- [x] 2.1 In `backend/src/domain/ingredient-search/map-off-product.test.ts`, add a failing test asserting `serving_size`/`serving_quantity` map to `servingSize`/`servingQuantity` and `macrosPerUnit` is unaffected
- [x] 2.2 Add a failing test asserting a conflicting `energy-kcal_serving` is ignored and calories come from `energy-kcal_100g`
- [x] 2.3 Add failing tests for the omitted-fields and invalid-`serving_quantity` (0 / negative / non-numeric) cases leaving the result fields `undefined`
- [x] 2.4 Extend `OffProduct` in `map-off-product.ts` with `serving_size?: string` and `serving_quantity?: number | string`
- [x] 2.5 In `mapOffProduct`, populate `servingSize` when a non-empty string and `servingQuantity` only when it coerces to a finite, strictly positive number; keep nutrient reads on `_100g` only
- [x] 2.6 Run the OFF mapper tests — confirm all pass

## 3. Backend — OFF service query fields

- [x] 3.1 Add `serving_size,serving_quantity` to the `fields=` query in `searchByName` and `searchByBarcode` in `backend/src/infrastructure/ingredient-search/open-food-facts.service.ts`

## 4. Frontend — result shape

- [x] 4.1 Mirror `servingSize?: string` and `servingQuantity?: number` onto `IngredientSearchResult` in `frontend/src/domain/ingredient-search.ts`

## 5. Frontend — gram input default (TDD)

- [x] 5.1 In `frontend/src/features/log-ingredient/full-entry-confirm.test.tsx`, add a failing test asserting the input pre-fills with `result.servingQuantity` when no `defaultAmount` prop is passed
- [x] 5.2 Add a failing test asserting `defaultAmount` takes precedence over `servingQuantity`
- [x] 5.3 Add a failing test asserting the input stays empty when neither `defaultAmount` nor `servingQuantity` is present
- [x] 5.4 In `full-entry-confirm.tsx`, resolve the effective default as `defaultAmount ?? result.servingQuantity` and use it for the form's `defaultValues`
- [x] 5.5 Run the component tests — confirm all pass

## 6. Verify

- [x] 6.1 Run backend and frontend test suites; confirm green
- [x] 6.2 Run lint/format (oxlint + oxfmt) on changed files
