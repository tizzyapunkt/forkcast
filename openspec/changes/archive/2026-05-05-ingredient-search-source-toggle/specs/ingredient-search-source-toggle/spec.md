## ADDED Requirements

### Requirement: Backend search endpoint accepts a `sources` query parameter

The `GET /search-ingredients` endpoint SHALL accept an optional `sources` query parameter as a comma-separated list of source identifiers (`bls`, `off`). When `sources` is absent or empty, the system SHALL default to `['bls']`. Unknown values in the list SHALL be ignored. The resolved source set SHALL be forwarded to the `IngredientSearchService`.

#### Scenario: Default sources when param is absent

- **WHEN** a search request arrives without a `sources` query parameter
- **THEN** only BLS results are returned (as if `sources=bls` was specified)

#### Scenario: Explicit BLS-only sources

- **WHEN** a search request arrives with `?sources=bls`
- **THEN** only BLS results are returned and no call to Open Food Facts is made

#### Scenario: Both sources requested

- **WHEN** a search request arrives with `?sources=bls,off`
- **THEN** both BLS and OFF results are returned (BLS first), with the same fan-out behaviour as the existing composite service

#### Scenario: Unknown source values are ignored

- **WHEN** a search request arrives with `?sources=bls,unknown`
- **THEN** the unknown value is silently discarded and only BLS results are returned

### Requirement: `IngredientSearchService.searchByName` accepts an optional source set

The `searchByName` method on the `IngredientSearchService` port SHALL accept an optional `sources` parameter of type `Set<'BLS' | 'OFF'>`. Leaf implementations (`InMemoryBlsService`, `OpenFoodFactsService`) SHALL accept and ignore this parameter. `CompositeIngredientSearchService` SHALL only query providers whose identifier is present in the `sources` set; absent `sources` SHALL default to `new Set(['BLS'])`.

#### Scenario: Composite skips OFF when not in sources

- **WHEN** `searchByName` is called with `sources = new Set(['BLS'])`
- **THEN** the composite service does not call the OFF service's `searchByName`

#### Scenario: Composite queries both when both present

- **WHEN** `searchByName` is called with `sources = new Set(['BLS', 'OFF'])`
- **THEN** the composite service fans out to both BLS and OFF in parallel

#### Scenario: Leaf service ignores sources param

- **WHEN** `InMemoryBlsService.searchByName` is called with any `sources` value
- **THEN** it returns results as normal, ignoring the `sources` parameter

### Requirement: Frontend search API client forwards source preference

The `searchIngredients` API function SHALL accept an optional `sources` parameter (array of `'BLS' | 'OFF'`) and include it as a `sources` query param when calling the backend. When absent it SHALL omit the param (letting the backend apply its default).

#### Scenario: Sources omitted propagates backend default

- **WHEN** `searchIngredients(q)` is called without a `sources` argument
- **THEN** the HTTP request has no `sources` query param

#### Scenario: Sources forwarded correctly

- **WHEN** `searchIngredients(q, ['BLS', 'OFF'])` is called
- **THEN** the HTTP request includes `sources=bls,off`

### Requirement: `useSearchIngredients` accepts and includes source preference in query key

The `useSearchIngredients` hook SHALL accept an optional `sources` parameter and pass it through to `searchIngredients`. The React Query `queryKey` SHALL include the `sources` value so that changing the toggle triggers a fresh fetch rather than returning a cached result for a different source set.

#### Scenario: Toggling OFF invalidates cached BLS-only results

- **WHEN** `sources` changes from `['BLS']` to `['BLS', 'OFF']` for the same query
- **THEN** a new fetch is triggered instead of returning the previous cached response

### Requirement: SearchPanel exposes an OFF toggle defaulting to disabled

The `SearchPanel` component SHALL render a toggle control labelled "Open Food Facts" that enables or disables inclusion of OFF results. The toggle state SHALL be persisted in `localStorage` under the key `forkcast:off-enabled`. The default value SHALL be `false` (OFF disabled). When enabled, the component SHALL pass `['BLS', 'OFF']` as `sources` to `useSearchIngredients`; when disabled, it SHALL pass `['BLS']`.

#### Scenario: Toggle defaults to disabled on first use

- **WHEN** the component mounts and `localStorage` has no `forkcast:off-enabled` entry
- **THEN** the toggle renders in the off/unchecked state and only BLS results are fetched

#### Scenario: Enabling the toggle re-fetches with both sources

- **WHEN** the user flips the toggle to enabled
- **THEN** the component re-fetches with `sources=['BLS', 'OFF']` and results from both sources appear

#### Scenario: Toggle state survives remount

- **WHEN** the user previously enabled the toggle and the component unmounts and remounts
- **THEN** the toggle renders in the enabled state (read from `localStorage`)
