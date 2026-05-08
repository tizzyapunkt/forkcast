## MODIFIED Requirements

### Requirement: Backend search endpoint accepts a `sources` query parameter

The `GET /search-ingredients` endpoint SHALL accept an optional `sources` query parameter as a comma-separated list of source identifiers (`foods`, `off`). When `sources` is absent or empty, the system SHALL default to `['off']`. Unknown values in the list SHALL be ignored. The resolved source set SHALL be forwarded to the `IngredientSearchService`.

#### Scenario: Default sources when param is absent

- **WHEN** a search request arrives without a `sources` query parameter
- **THEN** only OFF results are returned (as if `sources=off` was specified) and no call is made to the FOODS service

#### Scenario: Explicit FOODS-only sources

- **WHEN** a search request arrives with `?sources=foods`
- **THEN** only FOODS results are returned and no call to Open Food Facts is made

#### Scenario: Both sources requested

- **WHEN** a search request arrives with `?sources=foods,off`
- **THEN** both FOODS and OFF results are returned (FOODS first), with the same fan-out behaviour as the existing composite service

#### Scenario: Unknown source values are ignored

- **WHEN** a search request arrives with `?sources=foods,unknown`
- **THEN** the unknown value is silently discarded and only FOODS results are returned

### Requirement: `IngredientSearchService.searchByName` accepts an optional source set

The `searchByName` method on the `IngredientSearchService` port SHALL accept an optional `sources` parameter of type `Set<'FOODS' | 'OFF'>`. Leaf implementations (`InMemoryFoodsService`, `OpenFoodFactsService`) SHALL accept and ignore this parameter. `CompositeIngredientSearchService` SHALL only query providers whose identifier is present in the `sources` set; absent `sources` SHALL default to `new Set(['OFF'])`.

#### Scenario: Composite skips FOODS when not in sources

- **WHEN** `searchByName` is called with `sources = new Set(['OFF'])`
- **THEN** the composite service does not call the FOODS service's `searchByName`

#### Scenario: Composite queries both when both present

- **WHEN** `searchByName` is called with `sources = new Set(['FOODS', 'OFF'])`
- **THEN** the composite service fans out to both FOODS and OFF in parallel

#### Scenario: Leaf service ignores sources param

- **WHEN** `InMemoryFoodsService.searchByName` is called with any `sources` value
- **THEN** it returns results as normal, ignoring the `sources` parameter

### Requirement: Frontend search API client forwards source preference

The `searchIngredients` API function SHALL accept an optional `sources` parameter (array of `'FOODS' | 'OFF'`) and include it as a `sources` query param when calling the backend. When absent it SHALL omit the param (letting the backend apply its default).

#### Scenario: Sources omitted propagates backend default

- **WHEN** `searchIngredients(q)` is called without a `sources` argument
- **THEN** the HTTP request has no `sources` query param

#### Scenario: Sources forwarded correctly

- **WHEN** `searchIngredients(q, ['FOODS', 'OFF'])` is called
- **THEN** the HTTP request includes `sources=foods,off`

### Requirement: `useSearchIngredients` accepts and includes source preference in query key

The `useSearchIngredients` hook SHALL accept an optional `sources` parameter and pass it through to `searchIngredients`. The React Query `queryKey` SHALL include the `sources` value so that changing the toggle triggers a fresh fetch rather than returning a cached result for a different source set.

#### Scenario: Toggling FOODS invalidates cached OFF-only results

- **WHEN** `sources` changes from `['OFF']` to `['FOODS', 'OFF']` for the same query
- **THEN** a new fetch is triggered instead of returning the previous cached response

### Requirement: SearchPanel exposes a FOODS toggle defaulting to disabled

The `SearchPanel` component SHALL render a toggle control labelled "Foods" (referencing the curated FOODS source) that enables or disables inclusion of FOODS results alongside the always-on OFF source. The toggle state SHALL be persisted in `localStorage` under the key `forkcast:foods-enabled`. The default value SHALL be `false` (FOODS disabled, OFF only). When enabled, the component SHALL pass `['FOODS', 'OFF']` as `sources` to `useSearchIngredients`; when disabled, it SHALL pass `['OFF']`.

#### Scenario: Toggle defaults to disabled on first use

- **WHEN** the component mounts and `localStorage` has no `forkcast:foods-enabled` entry
- **THEN** the toggle renders in the off/unchecked state and only OFF results are fetched

#### Scenario: Enabling the toggle re-fetches with both sources

- **WHEN** the user flips the toggle to enabled
- **THEN** the component re-fetches with `sources=['FOODS', 'OFF']` and results from both sources appear

#### Scenario: Toggle state survives remount

- **WHEN** the user previously enabled the toggle and the component unmounts and remounts
- **THEN** the toggle renders in the enabled state (read from `localStorage`)
