# ingredient-search-source-toggle

## Purpose

Allow the user to choose which ingredient sources are included in search results. The user's own food catalog is always searched, with no control to disable it; a toggle in the search panel adds Open Food Facts branded products alongside it, with the preference persisted across sessions.

## Requirements

### Requirement: Backend search endpoint accepts a `sources` query parameter

The `GET /search-ingredients` endpoint SHALL accept an optional `sources` query parameter as a comma-separated list of source identifiers (`catalog`, `off`, `scan`). When `sources` is absent or empty, the system SHALL default to `['catalog']`. Unknown values in the list — including the retired `foods` and `user` identifiers — SHALL be ignored. The resolved source set SHALL be forwarded to the `IngredientSearchService`.

#### Scenario: Default sources when param is absent

- **WHEN** a search request arrives without a `sources` query parameter
- **THEN** only catalog results are returned (as if `sources=catalog` was specified) and no call is made to Open Food Facts

#### Scenario: Explicit catalog-only sources

- **WHEN** a search request arrives with `?sources=catalog`
- **THEN** only catalog results are returned and no call to Open Food Facts is made

#### Scenario: Catalog and OFF requested together

- **WHEN** a search request arrives with `?sources=catalog,off`
- **THEN** results from the catalog and from OFF are returned, catalog first

#### Scenario: Unknown and retired source values are ignored

- **WHEN** a search request arrives with `?sources=catalog,foods,user,unknown`
- **THEN** the unrecognised values are silently discarded and only catalog results are returned

### Requirement: `IngredientSearchService.searchByName` accepts an optional source set

The `searchByName` method on the `IngredientSearchService` port SHALL accept an optional `sources` parameter of type `Set<'CATALOG' | 'OFF' | 'SCAN'>`. Leaf implementations SHALL accept and ignore this parameter. `CompositeIngredientSearchService` SHALL only query providers whose identifier is present in the `sources` set; absent `sources` SHALL default to `new Set(['CATALOG'])`. When `SCAN` is present in the set, the composite SHALL search scanned products by name using the shared folding helper, mapping hits through the existing scanned-product result mapper.

#### Scenario: Composite skips the catalog when not in sources

- **WHEN** `searchByName` is called with `sources = new Set(['OFF'])`
- **THEN** the composite service does not call the catalog service's `searchByName`

#### Scenario: Composite queries the catalog when requested

- **WHEN** `searchByName` is called with `sources = new Set(['CATALOG'])`
- **THEN** only the catalog is searched

#### Scenario: Composite searches scanned products by name when SCAN requested

- **WHEN** `searchByName("Skyr", new Set(['SCAN']))` is called and a scanned product named `Skyr` exists
- **THEN** the result list contains that product with `source: 'SCAN'`

#### Scenario: Leaf service ignores sources param

- **WHEN** the catalog search service's `searchByName` is called with any `sources` value
- **THEN** it returns results as normal, ignoring the `sources` parameter

### Requirement: Frontend search API client forwards source preference

The `searchIngredients` API function SHALL accept an optional `sources` parameter (array of `'CATALOG' | 'OFF' | 'SCAN'`) and include it as a `sources` query param when calling the backend. When absent it SHALL omit the param (letting the backend apply its default).

#### Scenario: Sources omitted propagates backend default

- **WHEN** `searchIngredients(q)` is called without a `sources` argument
- **THEN** the HTTP request has no `sources` query param

#### Scenario: Sources forwarded correctly

- **WHEN** `searchIngredients(q, ['CATALOG', 'OFF'])` is called
- **THEN** the HTTP request includes `sources=catalog,off`

### Requirement: `useSearchIngredients` accepts and includes source preference in query key

The `useSearchIngredients` hook SHALL accept an optional `sources` parameter and pass it through to `searchIngredients`. The React Query `queryKey` SHALL include the `sources` value so that changing the toggle triggers a fresh fetch rather than returning a cached result for a different source set.

#### Scenario: Toggling OFF invalidates cached catalog-only results

- **WHEN** `sources` changes from `['CATALOG']` to `['CATALOG', 'OFF']` for the same query
- **THEN** a new fetch is triggered instead of returning the previous cached response

### Requirement: SearchPanel always searches the catalog and exposes an Open Food Facts opt-in

The `SearchPanel` component SHALL always include the user's catalog in its search, with no control to disable it. It SHALL render a toggle control for Open Food Facts that adds branded product results alongside the always-on catalog results. The toggle state SHALL be persisted in `localStorage` and SHALL default to `false` (catalog only). When enabled, the component SHALL pass `['CATALOG', 'OFF']` as `sources` to `useSearchIngredients`; when disabled, it SHALL pass `['CATALOG']`. Any previously stored preference key for the retired Foods toggle SHALL be cleared on mount and MUST NOT affect which sources are searched.

#### Scenario: Catalog searched on first use with no stored preference

- **WHEN** the component mounts with no stored toggle preference and the user types a query
- **THEN** catalog results are fetched and displayed, and no call to Open Food Facts is made

#### Scenario: Own foods are reachable from the search box

- **WHEN** the user has confirmed a food during a previous import and searches for it in the picker
- **THEN** that food appears in the results with the `CATALOG` badge

#### Scenario: Enabling the toggle adds branded results

- **WHEN** the user flips the Open Food Facts toggle to enabled
- **THEN** the component re-fetches with `sources=['CATALOG', 'OFF']` and results from both sources appear, catalog first

#### Scenario: Toggle state survives remount

- **WHEN** the user previously enabled the Open Food Facts toggle and the component unmounts and remounts
- **THEN** the toggle renders in the enabled state (read from `localStorage`)

#### Scenario: Retired Foods preference has no effect

- **WHEN** the browser still holds the retired `forkcast:foods-enabled` key set to `false`
- **THEN** the catalog is still searched and the stale key is removed
