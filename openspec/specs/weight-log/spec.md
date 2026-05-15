# weight-log

## Purpose

Capture one weight reading per calendar date and derive a smoothed trend from those readings. Daily weight is too noisy to interpret in isolation (water, food in gut, glycogen, sodium); the value of this capability is the 7-day moving average and three rate-of-change indicators (weekly, 28-day, total) that answer the question "is my current training and nutrition approach working?".

## Requirements

### Requirement: One weight entry per calendar date
The system SHALL store at most one weight entry per calendar date. Writing an entry for a date that already has one MUST replace the previous value (upsert by `date`). The date is the natural key.

#### Scenario: First entry for a date
- **WHEN** the user logs a weight `{ date: "2026-05-15", weightKg: 78.4 }` and no entry exists for that date
- **THEN** the system persists the entry and a subsequent `GET /weight-log` includes it exactly once

#### Scenario: Overwriting an existing entry
- **WHEN** an entry `{ date: "2026-05-15", weightKg: 78.4 }` exists and the user logs `{ date: "2026-05-15", weightKg: 78.2 }`
- **THEN** the system retains exactly one entry for `2026-05-15` with `weightKg = 78.2`

#### Scenario: Distinct dates are independent
- **WHEN** the user logs entries for `2026-05-14` and `2026-05-15`
- **THEN** both entries are retained and listed independently

### Requirement: Weight entry validation
The system SHALL reject weight entries with invalid input and return a 400 response describing the failure. A valid entry MUST satisfy: `date` matches `YYYY-MM-DD` and parses to a real calendar date, `date` is not in the future relative to the server's current date, and `weightKg` is a finite number greater than 0 and at most 500. `weightKg` MUST be rounded to at most two decimal places (server may round; it MUST NOT silently truncate).

#### Scenario: Reject malformed date
- **WHEN** the user submits `{ date: "2026-13-40", weightKg: 78.4 }`
- **THEN** the system returns a 400 response and does not persist anything

#### Scenario: Reject future date
- **WHEN** today's server date is `2026-05-15` and the user submits `{ date: "2026-05-16", weightKg: 78.4 }`
- **THEN** the system returns a 400 response and does not persist anything

#### Scenario: Reject non-positive weight
- **WHEN** the user submits `{ date: "2026-05-15", weightKg: 0 }`
- **THEN** the system returns a 400 response and does not persist anything

#### Scenario: Reject unrealistic weight
- **WHEN** the user submits `{ date: "2026-05-15", weightKg: 501 }`
- **THEN** the system returns a 400 response and does not persist anything

### Requirement: List weight entries
The system SHALL expose `GET /weight-log` returning all persisted entries sorted ascending by `date`. Optional `from` and `to` query parameters (inclusive `YYYY-MM-DD`) MUST filter the result. If `from > to` the system MUST return an empty list (no error).

#### Scenario: Empty log
- **WHEN** no entries have been persisted and the user calls `GET /weight-log`
- **THEN** the system returns `{ entries: [] }` with status 200

#### Scenario: Ascending order
- **WHEN** entries for `2026-05-10`, `2026-05-12`, and `2026-05-11` have been persisted and the user calls `GET /weight-log`
- **THEN** the response lists them in the order `2026-05-10`, `2026-05-11`, `2026-05-12`

#### Scenario: Date-range filter
- **WHEN** entries exist for `2026-05-09`, `2026-05-10`, `2026-05-11`, `2026-05-12` and the user calls `GET /weight-log?from=2026-05-10&to=2026-05-11`
- **THEN** the response contains only the `2026-05-10` and `2026-05-11` entries

### Requirement: Delete a weight entry
The system SHALL expose `DELETE /weight-log/:date` which removes the entry for that date. The endpoint MUST be idempotent: deleting a date that has no entry returns 204 (no-op). The endpoint MUST reject malformed dates with 400 to keep the client surface honest.

#### Scenario: Remove existing entry
- **WHEN** an entry exists for `2026-05-15` and the user calls `DELETE /weight-log/2026-05-15`
- **THEN** the response is 204 and a subsequent `GET /weight-log` no longer includes that date

#### Scenario: Delete non-existent date
- **WHEN** no entry exists for `2026-05-15` and the user calls `DELETE /weight-log/2026-05-15`
- **THEN** the response is 204 and the log is unchanged

#### Scenario: Reject malformed date in path
- **WHEN** the user calls `DELETE /weight-log/not-a-date`
- **THEN** the response is 400

### Requirement: 7-day moving average computation
The system SHALL compute the 7-day moving average (`MA7`) of weight as the arithmetic mean of all entries whose `date` falls within the inclusive 7-day window ending on a reference date `asOf`. The MA MUST be defined only when the window contains at least 4 entries; otherwise it MUST be `null`. The computation MUST NOT interpolate missing days — only actual entries count.

#### Scenario: Sufficient data inside the window
- **WHEN** entries exist for five distinct dates within `[2026-05-09, 2026-05-15]` with weights summing to 392.0
- **THEN** `MA7(2026-05-15)` equals `392.0 / 5 = 78.40`

#### Scenario: Too few entries in the window
- **WHEN** only three entries exist in `[2026-05-09, 2026-05-15]`
- **THEN** `MA7(2026-05-15)` is `null`

#### Scenario: Entries outside the window are excluded
- **WHEN** entries exist for `2026-05-01` through `2026-05-05` (5 entries) and the user requests `MA7(2026-05-15)`
- **THEN** `MA7(2026-05-15)` is `null` because none of those entries fall within `[2026-05-09, 2026-05-15]`

### Requirement: Trend indicators (weekly rate, 28-day change, total change)
The system SHALL expose `GET /weight-log/trend?asOf=YYYY-MM-DD` returning the trend payload `{ current, movingAverage7d, weeklyRatePercent, changePercent28d, totalChangePercent, firstEntryDate, totalEntries, lastEntryDate }`. `asOf` MUST default to the server's current local date if omitted.

The percentages MUST be computed against the 7-day moving average, never against raw daily readings, and MUST follow these formulas:

- `weeklyRatePercent = (MA7(asOf) − MA7(asOf − 7d)) / MA7(asOf − 7d) × 100`
- `changePercent28d = (MA7(asOf) − MA7(asOf − 28d)) / MA7(asOf − 28d) × 100`
- `totalChangePercent = (MA7(asOf) − MA7(firstWindow)) / MA7(firstWindow) × 100`, where `firstWindow` is the earliest 7-day window ending on a date that has a non-null `MA7`.

Each percentage MUST be `null` whenever either operand of its formula is `null`. The system MUST NOT substitute zero or any other sentinel.

`current` MUST be the raw `weightKg` for the entry whose `date == asOf` if one exists, or `null` otherwise.

#### Scenario: All indicators computable
- **WHEN** the user has 30 days of dense daily entries and calls `GET /weight-log/trend`
- **THEN** `movingAverage7d`, `weeklyRatePercent`, `changePercent28d`, and `totalChangePercent` are all non-null finite numbers

#### Scenario: Insufficient history for 28-day comparison
- **WHEN** the user has 10 days of entries and calls `GET /weight-log/trend`
- **THEN** `movingAverage7d` and `weeklyRatePercent` may be non-null but `changePercent28d` is `null`

#### Scenario: Indicators with no MA at endpoint
- **WHEN** the trailing 7-day window has only 2 entries
- **THEN** `movingAverage7d` is `null` and all three percentages are `null`

#### Scenario: Indicators report a decrease
- **WHEN** the trailing 7d MA is 77.6 and the MA from 7 days ago is 78.4
- **THEN** `weeklyRatePercent` is approximately `(77.6 − 78.4) / 78.4 × 100 ≈ −1.02`

#### Scenario: `asOf` defaults to today
- **WHEN** the user calls `GET /weight-log/trend` without `asOf`
- **THEN** the response is identical to calling `GET /weight-log/trend?asOf=<server-today>`

### Requirement: Trend response also returns metadata about coverage
The trend response SHALL include `firstEntryDate`, `lastEntryDate`, and `totalEntries` so the UI can show coverage information (e.g. "Logging since 2026-04-01 · 35 entries") without a second request. Each field MUST be `null`/`0` when the log is empty.

#### Scenario: Empty log
- **WHEN** the log has no entries
- **THEN** the response has `firstEntryDate: null`, `lastEntryDate: null`, `totalEntries: 0`, and every numeric trend field is `null`

#### Scenario: Populated log
- **WHEN** the log has entries from `2026-04-01` through `2026-05-15` with 35 distinct dates
- **THEN** the response has `firstEntryDate: "2026-04-01"`, `lastEntryDate: "2026-05-15"`, `totalEntries: 35`

### Requirement: Persistence via JSON file repository
The system SHALL persist the weight log as a JSON array at `./data/weight-log.json` via a `JsonWeightLogRepository` adapter that implements the `WeightLogRepository` port. The adapter MUST be `Initializable` (creating the parent directory on `init()`), MUST round `weightKg` to two decimal places on write, and MUST be registered in the application bootstrap.

#### Scenario: File created on init
- **WHEN** the application starts and the `./data` directory does not exist
- **THEN** `init()` creates it without error

#### Scenario: Writes are flushed to disk
- **WHEN** the user logs a weight and the process restarts
- **THEN** a subsequent `GET /weight-log` returns the entry

#### Scenario: Rounding on write
- **WHEN** the user submits `{ date: "2026-05-15", weightKg: 78.4567 }`
- **THEN** the persisted entry has `weightKg = 78.46`
