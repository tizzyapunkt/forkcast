## 1. Backend — Domain Port

- [x] 1.1 Add optional `sources?: Set<'BLS' | 'OFF'>` parameter to `searchByName` on the `IngredientSearchService` interface
- [x] 1.2 Update `InMemoryBlsService.searchByName` to accept (and ignore) the new `sources` param — add/update test to confirm it still returns results regardless of the param
- [x] 1.3 Update `OpenFoodFactsService.searchByName` to accept (and ignore) the new `sources` param

## 2. Backend — Composite Service

- [x] 2.1 Update `CompositeIngredientSearchService.searchByName` to accept `sources` and default to `new Set(['BLS'])` when absent
- [x] 2.2 Skip the OFF fan-out when `'OFF'` is not in `sources`; skip the BLS fan-out when `'BLS'` is not in `sources`
- [x] 2.3 Update composite service tests: add case for BLS-only (OFF not called), add case for both sources (existing fan-out behaviour)

## 3. Backend — HTTP Handler

- [x] 3.1 Parse `?sources=bls,off` query param in `makeSearchIngredientsByNameHandler`; map to `Set<'BLS' | 'OFF'>` with default `new Set(['BLS'])` when absent/empty; ignore unknown values
- [x] 3.2 Forward the resolved source set to `service.searchByName`
- [x] 3.3 Add/update handler tests for: no param → BLS-only, `sources=bls` → BLS-only, `sources=bls,off` → both, unknown values ignored

## 4. Frontend — API Client

- [x] 4.1 Update `searchIngredients(q, sources?)` in `api/search-ingredients.ts` to accept an optional `sources: Array<'BLS' | 'OFF'>` param and append `?sources=bls,off` (lowercase, comma-joined) to the request when provided
- [x] 4.2 Update API client tests to cover: no sources → no param in URL, with sources → correct param appended

## 5. Frontend — Query Hook

- [x] 5.1 Update `useSearchIngredients` to accept `sources?: Array<'BLS' | 'OFF'>` and pass it to `searchIngredients`
- [x] 5.2 Include `sources` in the React Query `queryKey` so toggling triggers a fresh fetch
- [x] 5.3 Update hook tests to confirm different `sources` values produce separate cache entries

## 6. Frontend — SearchPanel Toggle

- [x] 6.1 Add a `useLocalStorage` utility (or inline equivalent) that reads/writes a boolean at `forkcast:off-enabled`, defaulting to `false`
- [x] 6.2 Wire the local-storage state into `SearchPanel`: derive `sources` as `['BLS', 'OFF']` when enabled, `['BLS']` when disabled; pass to `useSearchIngredients`
- [x] 6.3 Render a toggle control labelled "Open Food Facts" in the search panel header area
- [x] 6.4 Update `SearchPanel` tests: toggle defaults to off → only BLS query key, enabling toggle → both-source query key, remount with stored state → toggle reflects stored value
