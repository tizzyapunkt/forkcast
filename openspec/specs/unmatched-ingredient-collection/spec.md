# unmatched-ingredient-collection

## Purpose

Capture, expose, export, and clear the set of ingredient names that produced zero matches in the curated FOODS catalog during AI recipe import, so the user can periodically extend the catalog from real misses.

## Requirements

### Requirement: Strict-unmatched ingredients are recorded server-side during AI recipe import

The system SHALL record each ingredient produced by the AI recipe import flow whose `IngredientSearchService.searchByName` call against the FOODS source returns zero results ("strict unmatched"). Recording MUST happen as a side effect of the existing matching pipeline and MUST NOT change the recipe-draft response shape returned to the client. Matched rows (including unit-overridden, piece-dropped, and untracked-inherited matches) MUST NOT be recorded.

#### Scenario: Unmatched extracted ingredient is recorded

- **WHEN** the AI recipe import flow extracts an ingredient whose name produces zero hits against the FOODS source
- **THEN** an entry for that name exists in the unmatched-ingredient store after the import completes
- **AND** the recipe-draft response returned to the client contains the same fields it would have returned with recording disabled

#### Scenario: Matched ingredient is not recorded

- **WHEN** the AI recipe import flow extracts an ingredient whose name produces at least one FOODS match
- **THEN** the unmatched-ingredient store is unchanged for that name, regardless of whether unit-override, piece-drop, or untracked-inheritance flags fire on the matched row

#### Scenario: Recording failure does not break the import response

- **WHEN** the unmatched-ingredient recorder throws while writing during an import
- **THEN** the import endpoint still returns `200` with the draft for the user to review
- **AND** an error is logged so the failure can be diagnosed

### Requirement: Unmatched entries are deduped by folded name with running count and capped samples

The unmatched-ingredient store SHALL identify entries by a folded name (the raw name lowercased and stripped of Unicode combining marks via NFD), reusing the same folding helper used by the FOODS in-memory index. Each stored entry SHALL contain:

- `name`: the raw name as the LLM returned it on first capture (display form; case and diacritics preserved).
- `foldedName`: the folding result used as the dedupe key.
- `count`: integer ≥ 1, incremented on each subsequent occurrence.
- `firstSeenAt`: ISO-8601 UTC timestamp of the first occurrence.
- `lastSeenAt`: ISO-8601 UTC timestamp of the most recent occurrence.
- `samples`: an ordered array of up to 5 occurrence payloads, each of shape `{ rawName: string; rawUnit?: 'g'|'ml'|'oz'|'cup'|'tbsp'|'tsp'|'piece'; rawDisplayUnitLabel?: string }`. When a 6th occurrence arrives, the oldest sample SHALL be dropped before the new sample is appended.

The store SHALL persist as a JSON file at `backend/data/unmatched-ingredients.json` with top-level shape `{ "entries": <Entry[]> }`, sorted by `foldedName` ascending, ending in a single trailing newline so diffs are reviewable.

#### Scenario: First occurrence creates an entry

- **WHEN** the import flow encounters the unmatched name `Buchweizenmehl` and no entry with that folded name exists
- **THEN** a new entry with `name: "Buchweizenmehl"`, `foldedName: "buchweizenmehl"`, `count: 1`, `firstSeenAt` equal to `lastSeenAt`, and one sample is appended to the store

#### Scenario: Repeat occurrence increments count and appends a sample

- **WHEN** the import flow encounters an unmatched name whose folded form matches an existing entry with `count: 2` and `2` samples
- **THEN** the entry's `count` becomes `3`, `lastSeenAt` is updated to the new occurrence time, `firstSeenAt` is unchanged, and the new occurrence is appended to `samples` (now length `3`)

#### Scenario: Diacritic and case folding dedupe a single canonical entry

- **WHEN** the import flow encounters `Möhre`, then `möhre`, then `MOHRE` across three imports
- **THEN** the store contains a single entry whose `foldedName` is `mohre` and whose `count` is `3`

#### Scenario: Samples list capped at five with oldest dropped

- **WHEN** an entry already has `5` samples and a sixth occurrence arrives
- **THEN** the entry's `samples` array length remains `5`, the previously-oldest sample is removed, and the new sample is the last element

### Requirement: Export endpoint returns the collected store without side effects

The system SHALL expose `GET /unmatched-ingredients/export` that returns the current store as JSON with status `200`. The endpoint MUST NOT modify the store. The response body's top-level shape MUST be `{ "entries": <Entry[]> }`, including when the store is empty. The endpoint SHALL require a valid session cookie like every other protected route; unauthenticated calls MUST return `401`.

#### Scenario: Export returns current entries

- **WHEN** an authenticated client calls `GET /unmatched-ingredients/export` and the store has three entries
- **THEN** the response is `200` with body `{ entries: [...] }` containing exactly those three entries
- **AND** a subsequent `GET /unmatched-ingredients/export` returns the same three entries (no side effect)

#### Scenario: Export returns empty list when store is empty

- **WHEN** the store has zero entries
- **THEN** `GET /unmatched-ingredients/export` returns `200` with body `{ entries: [] }`

#### Scenario: Unauthenticated export is rejected

- **WHEN** an unauthenticated client calls `GET /unmatched-ingredients/export`
- **THEN** the response is `401` and the store is unchanged

### Requirement: Clear endpoint atomically empties the store

The system SHALL expose `POST /unmatched-ingredients/clear` that atomically replaces the store with `{ entries: [] }` and returns `204`. The endpoint MUST require a valid session cookie. Concurrent or rapid repeated calls MUST leave the store in the empty state without corruption.

#### Scenario: Clear empties the store

- **WHEN** an authenticated client calls `POST /unmatched-ingredients/clear` and the store had ten entries
- **THEN** the response is `204` and a subsequent `GET /unmatched-ingredients/export` returns `{ entries: [] }`

#### Scenario: Clear on already-empty store

- **WHEN** an authenticated client calls `POST /unmatched-ingredients/clear` and the store is already empty
- **THEN** the response is `204` and the store remains empty

#### Scenario: Unauthenticated clear is rejected

- **WHEN** an unauthenticated client calls `POST /unmatched-ingredients/clear`
- **THEN** the response is `401` and the store is unchanged

### Requirement: Frontend exposes Export and Clear as distinct user actions

The frontend SHALL render a settings/admin surface with two distinct controls: an **Export** action that triggers `GET /unmatched-ingredients/export` and downloads the response body as a JSON file in the browser, and a **Clear** action that triggers `POST /unmatched-ingredients/clear` only after a confirm dialog. The Export action MUST NOT call the clear endpoint. Both controls SHALL be disabled (with a tooltip explaining why) when the store has zero entries.

The downloaded filename SHALL include a timestamp component (e.g. `unmatched-ingredients-YYYYMMDD-HHMM.json`) so multiple exports do not collide.

#### Scenario: Export downloads the file

- **WHEN** the user clicks the **Export** button with `3` entries collected
- **THEN** the browser downloads a JSON file containing those entries and the store is unchanged

#### Scenario: Clear requires explicit confirmation

- **WHEN** the user clicks the **Clear** button
- **THEN** a confirm dialog appears stating the number of entries that will be removed
- **AND** the store is emptied only after the user confirms; cancelling leaves the store unchanged

#### Scenario: Buttons disabled when store is empty

- **WHEN** the panel renders with `0` collected entries
- **THEN** both the Export and Clear buttons are disabled with an explanatory tooltip
