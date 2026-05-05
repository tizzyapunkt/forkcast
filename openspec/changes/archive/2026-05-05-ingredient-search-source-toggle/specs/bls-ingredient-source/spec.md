## MODIFIED Requirements

### Requirement: Composite ingredient search merges BLS and OFF results

The HTTP `/search-ingredients` endpoint SHALL be served by a composite `IngredientSearchService` that fans out to the sources specified in the request's `sources` parameter. When both `BLS` and `OFF` are requested the fan-out SHALL run in parallel and return a single merged list with BLS hits before OFF hits. When only one source is requested, only that source SHALL be queried. If one source fails, the other source's results SHALL still be returned.

#### Scenario: Both sources contribute results

- **WHEN** the user searches for `milch` with `sources=bls,off`
- **THEN** the response contains BLS results first (with `source: 'BLS'`) followed by OFF results (with `source: 'OFF'`)

#### Scenario: BLS-only request skips OFF entirely

- **WHEN** the user searches with `sources=bls`
- **THEN** the composite service does not call the OFF service and only BLS results are returned

#### Scenario: OFF source fails but BLS succeeds

- **WHEN** both sources are requested and the OFF API throws or rejects during a search
- **THEN** the response still contains the BLS-only results (and the OFF failure is logged server-side)

#### Scenario: BLS source returns nothing for a packaged product

- **WHEN** both sources are requested and the user searches for a brand name that exists only in OFF
- **THEN** the response contains only OFF results, with `source: 'OFF'`
