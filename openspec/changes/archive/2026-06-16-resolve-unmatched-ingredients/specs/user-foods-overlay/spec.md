# user-foods-overlay

## ADDED Requirements

### Requirement: User-foods overlay store persists confirmed foods and learned synonyms

The system SHALL persist a runtime-writable user-foods overlay as a JSON file at `backend/data/user-foods.json` with the top-level shape `{ "foods": <FoodEntry[]>, "synonyms": <LearnedSynonym[]> }`, where `FoodEntry` is exactly the curated foods entry shape (id, name, synonyms, unit `g|ml`, macrosPer100, optional pieces, optional untracked) and `LearnedSynonym` is `{ foodId: string, synonym: string }`. Entries appended to `foods` MUST pass the same validation rules as curated `foods.json` entries (canonical name, synonyms shape, unit, finite non-negative macros, untracked-implies-zero-macros, unique piece labels). A missing file MUST be treated as the empty store `{ foods: [], synonyms: [] }`. Writes MUST be atomic (no torn state on concurrent confirms).

#### Scenario: Confirmed new food persisted to the overlay

- **WHEN** a new-food resolution is confirmed with a valid entry `{ id: "kirschtomaten", name: "Kirschtomaten", synonyms: ["Cocktailtomaten"], unit: "g", macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 } }`
- **THEN** `user-foods.json` contains that entry in `foods` and the rest of the store is unchanged

#### Scenario: Invalid entry rejected at persistence

- **WHEN** a confirm arrives whose entry has `untracked: true` but non-zero `macrosPer100.calories`
- **THEN** the entry is rejected with a validation error and the overlay file is not modified

#### Scenario: Missing overlay file treated as empty store

- **WHEN** the backend boots and `backend/data/user-foods.json` does not exist
- **THEN** the overlay loads as `{ foods: [], synonyms: [] }` and the backend starts normally

### Requirement: Overlay foods are searchable as the `USER` ingredient source

The system SHALL expose overlay foods through the `IngredientSearchService` port as a distinct source `USER`, using the same case-/diacritic-insensitive folding, the same canonical-over-synonym tiered ranking, and the same per-unit macro derivation (per-100 divided by 100) as the curated FOODS source. Results SHALL carry `source: 'USER'`, the entry's `id`, canonical `name`, `unit`, `macrosPerUnit`, and `untracked` when set. A food confirmed at runtime MUST be findable by a `USER`-source search immediately, without backend restart.

#### Scenario: Confirmed food immediately searchable

- **WHEN** a new food `Kirschtomaten` is confirmed and a `USER`-source search for `kirschtomaten` runs in the same backend process
- **THEN** the result list contains an entry with `source: 'USER'`, `name: "Kirschtomaten"`, and macros derived from the confirmed per-100 values

#### Scenario: Overlay search uses the same folding rules

- **WHEN** the overlay contains a food named `Grüne Oliven` and the user searches for `grune oliven`
- **THEN** the `USER`-source results include that entry

### Requirement: Learned synonyms extend the curated index at runtime and at startup

When a `synonym-of` resolution is confirmed, the system SHALL append `{ foodId, synonym }` to the overlay and register the synonym on the in-memory curated FOODS index immediately, so subsequent FOODS searches match the curated entry via the new synonym. At startup, after `foods.json` loads, all overlay synonyms SHALL be re-applied to the index. A match via a learned synonym SHALL return the curated entry with `source: 'FOODS'` and its canonical name. A learned synonym whose `foodId` does not exist in the curated index (e.g. after a catalog rebuild removed the entry) SHALL be skipped with a logged warning, not crash startup.

#### Scenario: Learned synonym matches immediately

- **WHEN** the user confirms that `Cocktailtomaten` is a synonym of the curated entry `kirschtomaten` and then a FOODS search for `cocktailtomaten` runs in the same process
- **THEN** the results include the curated entry with `source: 'FOODS'` and `name` equal to its canonical name

#### Scenario: Learned synonyms survive restart

- **WHEN** the overlay contains `{ foodId: "moehre", synonym: "Wurzelgemüse-Karotte" }` and the backend restarts
- **THEN** a FOODS search for `wurzelgemüse-karotte` matches the `moehre` entry

#### Scenario: Orphaned synonym skipped with warning

- **WHEN** the overlay contains a synonym whose `foodId` is absent from the loaded curated catalog
- **THEN** the backend starts normally, that synonym is not registered, and a warning naming the `foodId` is logged

### Requirement: Atomic export-and-clear endpoint drains the overlay

The system SHALL expose `POST /export-user-foods` that returns the full overlay content `{ foods: [...], synonyms: [...] }` with status `200` and atomically replaces the store with the empty shape in the same operation. Learned synonyms registered on the in-memory index SHALL be unregistered as part of the clear. The endpoint SHALL require a valid session cookie; unauthenticated calls MUST return `401` and leave the store unchanged. An export of an empty store SHALL return the empty shape and succeed.

#### Scenario: Export returns content and clears the store

- **WHEN** an authenticated client calls `POST /export-user-foods` while the overlay holds two foods and one synonym
- **THEN** the response is `200` with exactly those entries
- **AND** a subsequent `POST /export-user-foods` returns `{ foods: [], synonyms: [] }`

#### Scenario: Export clears learned synonyms from the live index

- **WHEN** a learned synonym `Cocktailtomaten → kirschtomaten` is active and the overlay is exported
- **THEN** a subsequent FOODS search for `cocktailtomaten` no longer matches via the learned synonym

#### Scenario: Unauthenticated export rejected

- **WHEN** an unauthenticated client calls `POST /export-user-foods`
- **THEN** the response is `401` and the overlay is unchanged

### Requirement: Settings panel exposes the overlay export

The frontend settings surface SHALL replace the unmatched-ingredients panel with a user-foods overlay panel showing the current count of pending overlay entries (foods + synonyms) and an **Export** action that calls `POST /export-user-foods` and downloads the response as a JSON file with a timestamped filename (e.g. `user-foods-YYYYMMDD-HHMM.json`). The control SHALL be disabled when the overlay is empty. The panel copy MUST make clear that exporting drains the overlay (the file becomes the only copy until the catalog is rebuilt).

#### Scenario: Export downloads and empties

- **WHEN** the user taps **Export** with 3 overlay foods collected
- **THEN** the browser downloads a JSON file containing those entries and the panel afterwards shows 0 pending entries

#### Scenario: Export disabled when empty

- **WHEN** the panel renders with an empty overlay
- **THEN** the Export control is disabled with an explanatory hint

### Requirement: `USER` results are visually attributed in search lists

Frontend search-result lists that render source badges SHALL render a distinct badge for `source: 'USER'` results, and list keys SHALL remain `${source}:${id}` so a user food and a curated food with the same id render as distinct rows.

#### Scenario: USER badge rendered

- **WHEN** the picker search returns a result with `source: 'USER'`
- **THEN** the row shows the user-source badge (distinct from FOODS and OFF)
