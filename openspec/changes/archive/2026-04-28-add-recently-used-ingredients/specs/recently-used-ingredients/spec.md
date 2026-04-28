## ADDED Requirements

### Requirement: List of previously used ingredients
The system SHALL expose a query that returns every distinct ingredient the user has previously logged as a full entry, sorted by date of last use in descending order.

Two log entries refer to the SAME ingredient when their `name` (case-insensitive) and `unit` are equal. When multiple entries collapse to the same ingredient, the system MUST surface the macros from the entry with the most recent `loggedAt`, and MUST set `lastUsedAt` to that most recent `loggedAt`.

Quick entries (`type === 'quick'`) MUST NOT appear in the list — only full entries (`type === 'full'`) qualify.

#### Scenario: No log history
- **WHEN** the user has never logged any entries
- **THEN** the query returns an empty list

#### Scenario: Only quick entries
- **WHEN** the user has logged only quick entries (free-form labels)
- **THEN** the query returns an empty list

#### Scenario: Single full entry
- **WHEN** the user has logged exactly one full entry for "Oats / g"
- **THEN** the query returns a single result with that name, unit, and macros, and `lastUsedAt` equals the entry's `loggedAt`

#### Scenario: Duplicate ingredient — latest wins
- **WHEN** the user has logged "Oats / g" twice, once with old macros and once later with corrected macros
- **THEN** the query returns one result whose `macrosPerUnit` matches the later entry and whose `lastUsedAt` equals the later `loggedAt`

#### Scenario: Same name, different units are distinct
- **WHEN** the user has logged "Milk / ml" and "Milk / cup"
- **THEN** the query returns two distinct results

#### Scenario: Case-insensitive name matching
- **WHEN** the user has logged "Skyr / g" and "skyr / g"
- **THEN** the query returns one result, collapsing both entries

#### Scenario: Sorted by recency
- **WHEN** the user has logged ingredients A (yesterday), B (today), C (last week)
- **THEN** the query returns them in order B, A, C

### Requirement: HTTP endpoint to fetch the list
The system SHALL expose `GET /recently-used-ingredients` that returns the full list of recently used ingredients as JSON.

The response MUST be a JSON array of `{ name, unit, macrosPerUnit, lastUsedAt }` objects, sorted by `lastUsedAt` descending. The endpoint MUST NOT accept query parameters in this version (no server-side filtering or pagination). The endpoint MUST return `200 OK` with an empty array when no history exists (NOT `404`).

#### Scenario: Empty history
- **WHEN** a client sends `GET /recently-used-ingredients` and no full entries exist
- **THEN** the response is `200 OK` with body `[]`

#### Scenario: Populated history
- **WHEN** a client sends `GET /recently-used-ingredients` and full entries exist
- **THEN** the response is `200 OK` with a JSON array sorted by `lastUsedAt` descending

#### Scenario: Query parameters ignored
- **WHEN** a client sends `GET /recently-used-ingredients?q=oat`
- **THEN** the response contains the full unfiltered list (server-side `q` is not implemented)

### Requirement: "Recent" tab in the log drawer
The log drawer SHALL present a "Recent" tab as the second tab, with the order Search → Recent → Quick. The default selected tab on drawer open remains "Search".

#### Scenario: Tab ordering
- **WHEN** the log drawer opens
- **THEN** the tab bar shows three tabs in the order: Search, Recent, Quick

#### Scenario: Default tab unchanged
- **WHEN** the log drawer opens
- **THEN** the Search tab is selected by default

### Requirement: Lazy fetch of the recents list
The frontend MUST fetch the recently used ingredients list only when the drawer is open AND the Recent tab is currently selected. It MUST NOT fetch on drawer open if the user lands on Search or Quick.

#### Scenario: Drawer opens on Search tab
- **WHEN** the user opens the drawer and stays on the Search tab
- **THEN** no `GET /recently-used-ingredients` request is sent

#### Scenario: User selects Recent tab
- **WHEN** the user opens the drawer and switches to the Recent tab
- **THEN** a `GET /recently-used-ingredients` request is sent and the list renders on success

#### Scenario: User toggles back to Recent within the same drawer session
- **WHEN** the user already loaded Recents during this drawer session and switches away and back
- **THEN** the cached list is used and no additional network request is sent

### Requirement: Local fuzzy search over the list
The Recent tab SHALL provide a search input that filters the loaded list **client-side** with fuzzy matching. The search MUST NOT trigger any network request. Sort order of results SHOULD reflect fuzzy match score, falling back to `lastUsedAt` descending for equal scores.

#### Scenario: Empty query shows full list
- **WHEN** the search input is empty
- **THEN** the panel shows the full list sorted by `lastUsedAt` descending

#### Scenario: Fuzzy match on partial token
- **WHEN** the user types "oat" and "Oats" exists in the list
- **THEN** "Oats" appears in the filtered results

#### Scenario: Typo-tolerant match
- **WHEN** the user types "skir" and "Skyr" exists in the list
- **THEN** "Skyr" appears in the filtered results

#### Scenario: No matches
- **WHEN** the search query has no fuzzy matches in the list
- **THEN** the panel shows an empty-result state

### Requirement: Selecting a recent ingredient flows through full-entry confirm
When the user picks an ingredient from the Recent list, the drawer MUST transition to the existing full-entry confirm step (amount input + log), reusing the same code path as a Search-result selection. The picked ingredient MUST contribute its `name`, `unit`, and `macrosPerUnit` to the resulting log entry.

#### Scenario: Pick from Recent tab logs a full entry
- **WHEN** the user taps an ingredient in the Recent tab and submits the amount
- **THEN** a full `LogEntry` is persisted with the picked `name`, `unit`, `macrosPerUnit`, and submitted `amount`

#### Scenario: Back from confirm returns to Recent tab
- **WHEN** the user is on the confirm step after picking from Recent and presses Back
- **THEN** the drawer returns to the Recent tab list, not the Search tab
