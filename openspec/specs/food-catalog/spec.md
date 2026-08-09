# food-catalog

## Purpose

Provide a single, runtime-editable catalog of the user's foods that is the app's primary ingredient source. The catalog is seeded once from a starting point bundled with the backend image, then lives in the data volume where it can be searched, created, corrected, and deleted entirely from inside the app — replacing the immutable curated FOODS dataset and the write-only user-foods overlay.

## Requirements

### Requirement: Catalog is a runtime-writable store loaded at startup

The system SHALL persist the food catalog as a JSON file in the backend data directory holding an array of catalog entries, and SHALL load it into an in-memory searchable index at startup. Each entry SHALL have:

- `id`: a stable, lowercase, ASCII kebab-case identifier (e.g. `moehre`, `huehnchenbrust`), unique within the catalog.
- `name`: the canonical display name in German (e.g. `Möhre`, `Hähnchenbrust`).
- `synonyms`: an array (possibly empty) of alternate names; entries MAY mix German and English. The canonical `name` MUST NOT appear in `synonyms` (case-insensitive).
- `unit`: either `'g'` or `'ml'`.
- `macrosPer100`: an object with finite non-negative `calories`, `protein`, `carbs`, and `fat` values per 100 of `unit`.
- `pieces`: an OPTIONAL array of `{ label: string; grams: number }` objects. Each `label` SHALL be unique within an entry and each `grams` SHALL be a positive finite number. The field SHALL be omitted entirely (not an empty array) when it does not apply.
- `untracked`: an OPTIONAL boolean. When `true`, `macrosPer100` MUST equal `{ calories: 0, protein: 0, carbs: 0, fat: 0 }` exactly. The field SHALL be omitted entirely (not set to `false`) when the entry is tracked.

Entries that fail validation at load time SHALL be skipped and a single warning SHALL be logged naming the offending entry's `id`; the backend MUST still start. All writes to the store SHALL be atomic, leaving no torn state if a write is interrupted.

#### Scenario: Valid catalog loads into the search index

- **WHEN** the backend boots with a catalog file containing well-formed entries
- **THEN** the in-memory catalog index is initialized and reports `>0` entries available for search

#### Scenario: Malformed entry is skipped with a warning

- **WHEN** the catalog file contains 50 valid entries and 1 entry whose `macrosPer100.calories` is `null`
- **THEN** the index initializes with 50 entries and a single warning is logged naming the bad entry's `id`

#### Scenario: Untracked entry with non-zero macros is rejected

- **WHEN** an entry has `untracked: true` and `macrosPer100.calories` of `12`
- **THEN** the entry is rejected and a warning is logged naming its `id`

#### Scenario: Canonical name appearing in synonyms is rejected

- **WHEN** an entry has `name: "Möhre"` and `synonyms: ["Möhre", "Karotte"]`
- **THEN** the entry is rejected and a warning is logged naming its `id`

### Requirement: Catalog is seeded from the bundled starting point only when absent

The backend image SHALL ship a starting-point catalog stored outside the data volume. On startup the system SHALL install that starting point into the data directory **only when no catalog file is present there**. When a catalog file already exists in the data directory, the system MUST use it unchanged and MUST NOT overwrite, merge, or reconcile it against the bundled starting point. Deploying a new image whose starting point differs from the live catalog MUST NOT alter the live catalog.

#### Scenario: Fresh volume is seeded

- **WHEN** the backend starts against a data directory that contains no catalog file
- **THEN** the bundled starting point is installed as the catalog and the backend serves its entries

#### Scenario: Existing catalog survives a deploy

- **WHEN** the user has edited the catalog (added, changed, and deleted entries) and a new image with a different bundled starting point is deployed
- **THEN** after restart the catalog still contains exactly the user's edited entries and none of the starting point's differences

#### Scenario: Restart does not resurrect deleted entries

- **WHEN** the user deletes an entry that exists in the bundled starting point and the container restarts
- **THEN** the entry is still absent from the catalog and from search results

### Requirement: Existing user-foods overlay is migrated into the catalog once

On first startup after this change, when a legacy user-foods overlay file is present, the system SHALL fold its contents into the catalog: each overlay food SHALL be appended as a catalog entry (skipped with a logged warning when its `id` already exists), and each learned `{ foodId, synonym }` pair SHALL be added to the `synonyms` of the catalog entry with that `id` (deduplicated case-insensitively, and skipped with a logged warning when no such entry exists). After a successful migration the legacy overlay file SHALL no longer be read, and the migration MUST NOT run again on subsequent startups.

#### Scenario: Overlay foods and synonyms folded in

- **WHEN** the backend starts with an overlay holding the food `balsamicoessig` and the pair `{ foodId: "cherrytomate", synonym: "Kirschtomaten" }`, and the catalog contains `cherrytomate`
- **THEN** the catalog gains a `balsamicoessig` entry and the `cherrytomate` entry's `synonyms` include `Kirschtomaten`

#### Scenario: Orphaned synonym skipped with a warning

- **WHEN** the overlay holds a synonym whose `foodId` is absent from the catalog
- **THEN** the backend starts normally, that synonym is not applied, and a warning naming the `foodId` is logged

#### Scenario: Migration is not repeated

- **WHEN** the backend has already migrated the overlay and is restarted
- **THEN** no overlay content is re-applied and no duplicate entries or synonyms appear in the catalog

### Requirement: Catalog entries can be created, edited, and deleted at runtime

The system SHALL expose authenticated operations to create a catalog entry, update an existing entry, and delete an entry by `id`. Create and update SHALL apply the same validation rules as load-time validation and MUST reject an invalid payload with a `400`, leaving the catalog unchanged. Create MUST reject an `id` that already exists. Update and delete MUST return `404` for an unknown `id`. Every accepted write SHALL be reflected in search results immediately, without a backend restart, and SHALL be durable across restarts. Unauthenticated calls MUST return `401` and leave the catalog unchanged.

#### Scenario: Created entry is immediately searchable

- **WHEN** an authenticated client creates the entry `{ id: "balsamicoessig", name: "Balsamicoessig", synonyms: ["Balsamico-Essig"], unit: "ml", macrosPer100: { calories: 88, protein: 0, carbs: 17, fat: 0 } }`
- **THEN** a catalog search for `balsamico` in the same backend process returns that entry

#### Scenario: Edited macros take effect immediately

- **WHEN** the user corrects an entry's `macrosPer100.calories` from `290` to `250`
- **THEN** subsequent searches return the entry with the corrected value and the change survives a restart

#### Scenario: Deleted entry disappears from search

- **WHEN** the user deletes the entry `getrocknete-tomaten-in-oel`
- **THEN** it is absent from catalog search results and from the persisted catalog

#### Scenario: Invalid edit rejected without side effects

- **WHEN** an update sets `untracked: true` while leaving non-zero macros
- **THEN** the response is `400` and the stored entry is unchanged

#### Scenario: Duplicate id rejected

- **WHEN** a create names an `id` that already exists in the catalog
- **THEN** the response is `400` and the existing entry is unchanged

#### Scenario: Unauthenticated write rejected

- **WHEN** an unauthenticated client attempts to create, update, or delete an entry
- **THEN** the response is `401` and the catalog is unchanged

### Requirement: Deleting a catalog entry does not alter saved recipes or logged days

Recipes and meal-log entries SHALL continue to store a snapshot of the ingredient's name, unit, and per-unit macros rather than a reference to a catalog entry. Consequently, deleting or editing a catalog entry MUST NOT change, invalidate, or recompute any previously saved recipe or log entry.

#### Scenario: Saved recipe unaffected by deletion

- **WHEN** a recipe contains an ingredient sourced from catalog entry `olivenoel` and that entry is deleted
- **THEN** the recipe still lists the ingredient with its original name, unit, amount, and macros, and its per-portion totals are unchanged

#### Scenario: Logged day unaffected by an edit

- **WHEN** a day's log contains an entry sourced from a catalog entry whose macros are then corrected
- **THEN** that day's totals are unchanged

### Requirement: Catalog name search is case- and diacritic-insensitive across canonical name and synonyms

The system SHALL match a query against each entry's canonical `name` and each of its `synonyms` by substring comparison after lowercasing and stripping Unicode combining marks (NFD → strip diacritics). Both the query and the indexed strings SHALL be folded. Queries shorter than 2 characters after trimming SHALL return an empty list.

#### Scenario: Diacritic folding matches German names without umlauts

- **WHEN** the user searches for `mohre`
- **THEN** the results include the entry whose canonical name is `Möhre`

#### Scenario: Synonym match returns the canonical name

- **WHEN** the user searches for `karotte` and an entry has `name: "Möhre"` with `synonyms: ["Karotte"]`
- **THEN** the results include a result whose `name` is `Möhre`

#### Scenario: Too-short query

- **WHEN** the user submits a query of 0 or 1 character after trimming
- **THEN** the catalog returns an empty list

### Requirement: Catalog search results carry source attribution and macros

Each catalog result SHALL conform to the shared `IngredientSearchResult` shape with `source: 'CATALOG'`, `id` set to the entry's id, `name` set to the entry's canonical name, `unit` set to the entry's unit, and `macrosPerUnit` derived by dividing each per-100 value by 100. When the entry has `untracked: true` the result SHALL carry `untracked: true`; otherwise it SHALL carry `untracked: false` or omit the field, and consumers MUST treat absent and `false` as equivalent.

#### Scenario: Result shape includes source, id, and unit

- **WHEN** any catalog entry is returned from a name search
- **THEN** the result has `source === 'CATALOG'`, `id` equal to the entry's id, `unit` equal to the entry's unit, and `macrosPerUnit` populated

#### Scenario: Macros are scaled per gram or millilitre

- **WHEN** an entry has `unit: "g"` and `macrosPer100 = { calories: 250, protein: 10, carbs: 0, fat: 23 }`
- **THEN** the returned `macrosPerUnit` has `calories === 2.5`, `protein === 0.1`, `carbs === 0`, and `fat === 0.23`

#### Scenario: Untracked flag carried through

- **WHEN** an entry with `untracked: true` matches a query
- **THEN** the returned result carries `untracked: true`

### Requirement: Catalog search results are ranked with canonical-over-synonym tiering

The system SHALL rank catalog results by a tiered relevance score, where each entry's score is the maximum of (i) the score against its folded canonical name using the canonical tier values and (ii) the maximum score across its folded synonyms using the synonym tier values. The five tiers, highest to lowest, are: exact, whole-word, prefix, token-start, substring. Token boundaries are start-of-string, end-of-string, or one of: whitespace, `,`, `(`, `)`, `/`, `-`. Canonical tier values SHALL be strictly higher than the corresponding synonym tier values.

#### Scenario: Exact canonical match outranks substring canonical match

- **WHEN** the user searches for `Möhre` and the catalog contains both an entry whose `name` equals `Möhre` and entries whose `name` merely contains the word
- **THEN** the entry whose `name` equals `Möhre` appears first

#### Scenario: Canonical match outranks synonym match of the same tier

- **WHEN** entry A has `Karotte` among its `synonyms` and entry B has `name` equal to `Karotte`, and the user searches for `Karotte`
- **THEN** entry B appears before entry A

#### Scenario: Best synonym match contributes when no canonical match exists

- **WHEN** the user searches for `carrot`, an entry's canonical name does not contain the query, and one of its synonyms equals `carrot`
- **THEN** that entry is included with the synonym-tier exact score

### Requirement: Catalog search ties are broken by canonical name length, then locale order

When two entries have the same relevance score, the system SHALL order them by canonical `name` length ascending, then by `name.localeCompare`. Ordering SHALL be deterministic across calls with the same query and catalog content.

#### Scenario: Shorter name wins within the same tier

- **WHEN** two entries produce the same-tier canonical match and one `name` is shorter
- **THEN** the shorter-named entry appears first

#### Scenario: Locale order breaks remaining ties

- **WHEN** two entries have the same score and the same `name` length
- **THEN** they are ordered by `name.localeCompare` and repeat queries return the same order

### Requirement: Catalog search result count is bounded

The catalog search SHALL return at most 20 results per query, selected as the 20 highest-ranked entries with ties broken per the tie-break requirement. A matched entry with a strictly higher score than an included entry SHALL never be excluded.

#### Scenario: Match list capped at the 20 highest-ranked entries

- **WHEN** a query matches more than 20 catalog entries
- **THEN** only the 20 entries with the highest relevance scores are returned

### Requirement: Barcode lookup remains Open Food Facts only

The catalog SHALL NOT participate in barcode lookup. Barcode lookup SHALL continue to query Open Food Facts and return either a single `OFF`-tagged result or a `404`.

#### Scenario: Known barcode resolves via OFF

- **WHEN** the user submits a barcode that exists in OFF
- **THEN** the response is a single result with `source: 'OFF'`

#### Scenario: Unknown barcode

- **WHEN** the user submits a barcode unknown to OFF
- **THEN** the response is a `404`

### Requirement: Search-result source discriminator enumerates the supported sources

The `IngredientSearchResult` type (backend and frontend) SHALL expose `source: 'CATALOG' | 'OFF' | 'SCAN'` alongside its `id: string`. The literals `'FOODS'` and `'USER'` SHALL NOT be valid values of `source`.

#### Scenario: Catalog mapper sets source and id

- **WHEN** a catalog entry is mapped to a search result
- **THEN** the result has `source: 'CATALOG'` and `id` equal to the entry's id

#### Scenario: OFF mapper sets source and id

- **WHEN** an OFF product is mapped to a search result
- **THEN** the result has `source: 'OFF'` and `id` equal to the OFF product code

### Requirement: Frontend renders a source-attribution badge per result

Frontend search-result lists SHALL render a badge next to each result showing its `source` (`CATALOG`, `OFF`, or `SCAN`). The list key for each result SHALL be `${source}:${id}` so results sharing an id across sources render as distinct rows.

#### Scenario: Badge visible on each row

- **WHEN** a search result list renders with at least one result
- **THEN** every row shows a badge corresponding to the result's `source`

#### Scenario: Same id across sources renders distinct rows

- **WHEN** an OFF result and a catalog result share the same `id` value
- **THEN** both rows render without duplicate-key warnings

### Requirement: Catalog manager screen lists, searches, and edits the catalog

The frontend SHALL provide a catalog manager screen, reachable from settings, that lists catalog entries with their canonical name, unit, and per-100 calories, offers a text filter over name and synonyms, and supports creating a new entry, editing an existing entry, and deleting an entry. The editor SHALL expose name, synonyms, unit (`g`/`ml`), the four per-100 macro values, the untracked flag, and piece weights. Validation errors SHALL be surfaced inline without discarding the user's input. Deletion SHALL require an explicit confirmation step.

#### Scenario: Entry corrected from the manager

- **WHEN** the user opens an entry whose macros are wrong, corrects the calories, and saves
- **THEN** the list shows the corrected value and a subsequent ingredient search returns the corrected macros

#### Scenario: Bad synonym removed

- **WHEN** the user removes the synonym `Ölpacked getrocknete Tomaten` from an entry and saves
- **THEN** the entry no longer carries that synonym and a search for it no longer matches the entry

#### Scenario: Deletion is confirmed before it happens

- **WHEN** the user taps delete on an entry
- **THEN** a confirmation is required before the entry is removed, and dismissing it leaves the entry in place

#### Scenario: Invalid input surfaced inline

- **WHEN** the user marks an entry untracked while its macros are non-zero and saves
- **THEN** an inline error explains the conflict and the user's in-progress input is preserved

### Requirement: Creating a food by hand starts blank with an optional AI fill

The catalog manager's create form SHALL open with empty fields and SHALL NOT call any AI service on open. It SHALL offer an explicit fill action that, when invoked with a non-empty name, requests suggested unit, synonyms, and per-100 macros and populates the corresponding fields, marking the populated macro values as estimates. The user SHALL be able to edit every filled field before saving, and SHALL be able to save a hand-typed entry without ever invoking the fill action. A failed fill request SHALL surface an error and leave the user's input intact.

#### Scenario: Form opens empty and makes no AI call

- **WHEN** the user opens the create form
- **THEN** all fields are empty and no AI request has been made

#### Scenario: Fill populates suggestions on request

- **WHEN** the user types `Balsamicoessig` and invokes the fill action
- **THEN** unit, synonyms, and per-100 macros are populated with suggestions and the macro values are marked as estimates

#### Scenario: Hand-typed entry saves without AI

- **WHEN** the user fills every field manually and saves without invoking the fill action
- **THEN** the entry is created with exactly the typed values

#### Scenario: Failed fill preserves input

- **WHEN** the fill request fails
- **THEN** an error is shown and the fields the user already typed are unchanged

### Requirement: Catalog snapshot export downloads without mutating the catalog

The system SHALL expose an authenticated export that returns the full catalog content and SHALL NOT modify, clear, or drain the catalog as part of the export. The settings surface SHALL offer an action that downloads the snapshot as a JSON file with a timestamped filename, and SHALL show the current catalog entry count. Unauthenticated calls MUST return `401`.

#### Scenario: Export downloads and leaves the catalog intact

- **WHEN** the user exports a catalog holding 186 entries
- **THEN** a JSON file containing all 186 entries is downloaded
- **AND** the catalog still holds exactly those 186 entries afterwards

#### Scenario: Repeat export returns the same content

- **WHEN** the user exports twice with no edits in between
- **THEN** both exports contain the same entries

#### Scenario: Unauthenticated export rejected

- **WHEN** an unauthenticated client requests the export
- **THEN** the response is `401` and the catalog is unchanged
