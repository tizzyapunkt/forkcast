## MODIFIED Requirements

### Requirement: List of previously used ingredients
The system SHALL expose a query that returns every distinct ingredient the user has previously logged as a full entry, sorted by date of last use in descending order.

Two log entries refer to the SAME ingredient when their `name` (case-insensitive) and `unit` are equal. When multiple entries collapse to the same ingredient, the system MUST surface the macros from the entry with the most recent `loggedAt`, MUST set `lastUsedAt` to that most recent `loggedAt`, and MUST set `lastAmount` to the `amount` of that same most-recent entry.

Quick entries (`type === 'quick'`) MUST NOT appear in the list — only full entries (`type === 'full'`) qualify.

#### Scenario: No log history
- **WHEN** the user has never logged any entries
- **THEN** the query returns an empty list

#### Scenario: Only quick entries
- **WHEN** the user has logged only quick entries (free-form labels)
- **THEN** the query returns an empty list

#### Scenario: Single full entry
- **WHEN** the user has logged exactly one full entry for "Oats / g" with amount 80
- **THEN** the query returns a single result with that name, unit, and macros, `lastUsedAt` equals the entry's `loggedAt`, and `lastAmount` equals 80

#### Scenario: Duplicate ingredient — latest wins for amount and macros
- **WHEN** the user has logged "Oats / g" twice — first with amount 60 and old macros, then later with amount 80 and corrected macros
- **THEN** the query returns one result whose `macrosPerUnit` matches the later entry, whose `lastUsedAt` equals the later `loggedAt`, and whose `lastAmount` equals 80

#### Scenario: Same name, different units are distinct
- **WHEN** the user has logged "Milk / ml" with amount 250 and "Milk / cup" with amount 1
- **THEN** the query returns two distinct results, each carrying its own `lastAmount` (250 and 1 respectively)

#### Scenario: Case-insensitive name matching
- **WHEN** the user has logged "Skyr / g" (amount 150) and later "skyr / g" (amount 200)
- **THEN** the query returns one result whose `lastAmount` equals 200

#### Scenario: Sorted by recency
- **WHEN** the user has logged ingredients A (yesterday), B (today), C (last week)
- **THEN** the query returns them in order B, A, C

### Requirement: HTTP endpoint to fetch the list
The system SHALL expose `GET /recently-used-ingredients` that returns the full list of recently used ingredients as JSON.

The response MUST be a JSON array of `{ name, unit, macrosPerUnit, lastUsedAt, lastAmount }` objects, sorted by `lastUsedAt` descending. `lastAmount` MUST be a positive number copied from the latest collapsed log entry's `amount`. The endpoint MUST NOT accept query parameters in this version (no server-side filtering or pagination). The endpoint MUST return `200 OK` with an empty array when no history exists (NOT `404`).

#### Scenario: Empty history
- **WHEN** a client sends `GET /recently-used-ingredients` and no full entries exist
- **THEN** the response is `200 OK` with body `[]`

#### Scenario: Populated history includes lastAmount
- **WHEN** a client sends `GET /recently-used-ingredients` and full entries exist
- **THEN** the response is `200 OK` with a JSON array sorted by `lastUsedAt` descending, where every item includes a positive numeric `lastAmount` field

#### Scenario: Query parameters ignored
- **WHEN** a client sends `GET /recently-used-ingredients?q=oat`
- **THEN** the response contains the full unfiltered list (server-side `q` is not implemented)

### Requirement: Selecting a recent ingredient flows through full-entry confirm
When the user picks an ingredient from the Recent list, the drawer MUST transition to the existing full-entry confirm step (amount input + log), reusing the same code path as a Search-result selection. The picked ingredient MUST contribute its `name`, `unit`, and `macrosPerUnit` to the resulting log entry. The confirm step's amount input MUST be pre-filled with the picked ingredient's `lastAmount`. Selections originating from non-Recent paths (Search, Barcode) MUST continue to open the confirm step with an empty amount input.

#### Scenario: Pick from Recent tab pre-fills the amount
- **WHEN** the user taps an ingredient in the Recent tab whose `lastAmount` is 80
- **THEN** the confirm step renders with `80` already filled into the amount input

#### Scenario: Pick from Recent tab logs a full entry
- **WHEN** the user taps an ingredient in the Recent tab and submits the pre-filled amount unchanged
- **THEN** a full `LogEntry` is persisted with the picked `name`, `unit`, `macrosPerUnit`, and `lastAmount` as `amount`

#### Scenario: User edits the pre-filled amount before logging
- **WHEN** the user taps an ingredient in the Recent tab, changes the pre-filled amount to a different positive number, and submits
- **THEN** a full `LogEntry` is persisted with the edited amount, not `lastAmount`

#### Scenario: Search-result selection still opens with an empty amount
- **WHEN** the user picks an ingredient from the Search tab
- **THEN** the confirm step renders with an empty amount input

#### Scenario: Back from confirm returns to Recent tab
- **WHEN** the user is on the confirm step after picking from Recent and presses Back
- **THEN** the drawer returns to the Recent tab list, not the Search tab
