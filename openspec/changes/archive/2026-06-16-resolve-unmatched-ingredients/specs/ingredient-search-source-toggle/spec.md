# ingredient-search-source-toggle — delta

## MODIFIED Requirements

### Requirement: Backend search endpoint accepts a `sources` query parameter

The `GET /search-ingredients` endpoint SHALL accept an optional `sources` query parameter as a comma-separated list of source identifiers (`foods`, `user`, `off`). When `sources` is absent or empty, the system SHALL default to `['off']`. Unknown values in the list SHALL be ignored. The resolved source set SHALL be forwarded to the `IngredientSearchService`.

#### Scenario: Default sources when param is absent

- **WHEN** a search request arrives without a `sources` query parameter
- **THEN** only OFF results are returned (as if `sources=off` was specified) and no call is made to the FOODS or USER services

#### Scenario: Explicit FOODS-only sources

- **WHEN** a search request arrives with `?sources=foods`
- **THEN** only FOODS results are returned and no call to Open Food Facts is made

#### Scenario: User source requested

- **WHEN** a search request arrives with `?sources=foods,user,off`
- **THEN** results from the curated FOODS source, the user-foods overlay, and OFF are returned (FOODS first, then USER, then OFF)

#### Scenario: Unknown source values are ignored

- **WHEN** a search request arrives with `?sources=foods,unknown`
- **THEN** the unknown value is silently discarded and only FOODS results are returned

### Requirement: `IngredientSearchService.searchByName` accepts an optional source set

The `searchByName` method on the `IngredientSearchService` port SHALL accept an optional `sources` parameter of type `Set<'FOODS' | 'USER' | 'OFF' | 'SCAN'>`. Leaf implementations SHALL accept and ignore this parameter. `CompositeIngredientSearchService` SHALL only query providers whose identifier is present in the `sources` set; absent `sources` SHALL default to `new Set(['OFF'])`. When `SCAN` is present in the set, the composite SHALL search scanned products by name using the shared folding helper, mapping hits through the existing scanned-product result mapper.

#### Scenario: Composite skips FOODS when not in sources

- **WHEN** `searchByName` is called with `sources = new Set(['OFF'])`
- **THEN** the composite service does not call the FOODS or USER services' `searchByName`

#### Scenario: Composite queries USER when requested

- **WHEN** `searchByName` is called with `sources = new Set(['USER'])`
- **THEN** only the user-foods overlay is searched

#### Scenario: Composite searches scanned products by name when SCAN requested

- **WHEN** `searchByName("Skyr", new Set(['SCAN']))` is called and a scanned product named `Skyr` exists
- **THEN** the result list contains that product with `source: 'SCAN'`

#### Scenario: Leaf service ignores sources param

- **WHEN** `InMemoryFoodsService.searchByName` is called with any `sources` value
- **THEN** it returns results as normal, ignoring the `sources` parameter

### Requirement: Frontend search API client forwards source preference

The `searchIngredients` API function SHALL accept an optional `sources` parameter (array of `'FOODS' | 'USER' | 'OFF'`) and include it as a `sources` query param when calling the backend. When absent it SHALL omit the param (letting the backend apply its default).

#### Scenario: Sources omitted propagates backend default

- **WHEN** `searchIngredients(q)` is called without a `sources` argument
- **THEN** the HTTP request has no `sources` query param

#### Scenario: Sources forwarded correctly

- **WHEN** `searchIngredients(q, ['FOODS', 'USER', 'OFF'])` is called
- **THEN** the HTTP request includes `sources=foods,user,off`

### Requirement: SearchPanel exposes a FOODS toggle defaulting to disabled

The `SearchPanel` component SHALL render a toggle control labelled "Foods" (referencing the user's own foods: the curated FOODS source plus the user-foods overlay) that enables or disables inclusion of those results alongside the always-on OFF source. The toggle state SHALL be persisted in `localStorage` under the key `forkcast:foods-enabled`. The default value SHALL be `false` (disabled, OFF only). When enabled, the component SHALL pass `['FOODS', 'USER', 'OFF']` as `sources` to `useSearchIngredients`; when disabled, it SHALL pass `['OFF']`.

#### Scenario: Toggle defaults to disabled on first use

- **WHEN** the component mounts and `localStorage` has no `forkcast:foods-enabled` entry
- **THEN** the toggle renders in the off/unchecked state and only OFF results are fetched

#### Scenario: Enabling the toggle re-fetches with curated and user foods

- **WHEN** the user flips the toggle to enabled
- **THEN** the component re-fetches with `sources=['FOODS', 'USER', 'OFF']` and results from all three sources appear

#### Scenario: Toggle state survives remount

- **WHEN** the user previously enabled the toggle and the component unmounts and remounts
- **THEN** the toggle renders in the enabled state (read from `localStorage`)
