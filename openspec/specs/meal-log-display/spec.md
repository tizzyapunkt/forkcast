# meal-log-display Specification

## Purpose
TBD - created by archiving change show-per-entry-macros-in-meal-log. Update Purpose after archive.
## Requirements
### Requirement: Daily log shows per-entry calories
The system SHALL display the calorie contribution of every log entry on the daily log screen, on the trailing side of the entry row. Values MUST be rounded to the nearest integer and suffixed with the localized `kcal` unit.

For `full` entries the calorie value MUST be computed as `ingredient.macrosPerUnit.calories * ingredient.amount` (rounded). For `quick` entries the calorie value MUST be the stored `ingredient.calories`.

#### Scenario: Full entry shows computed calories
- **GIVEN** a full entry with `macrosPerUnit.calories = 2.5` and `amount = 200`
- **WHEN** the entry row renders
- **THEN** the row shows `500 kcal` on the trailing side

#### Scenario: Quick entry shows stored calories
- **GIVEN** a quick entry with `calories = 80`
- **WHEN** the entry row renders
- **THEN** the row shows `80 kcal` on the trailing side

### Requirement: Daily log shows per-entry macros when available
The system SHALL display the protein, carbs, and fat contribution of every log entry alongside its calorie value when macro data is available for that entry. The macro suffix MUST follow the same compact inline format used by the slot summary: `· {P}g P · {C}g K · {F}g F`, with each value rounded to the nearest integer.

A `full` entry MUST always render its macro suffix, computed as `ingredient.macrosPerUnit.{protein,carbs,fat} * ingredient.amount`.

A `quick` entry MUST render its macro suffix only when **all three** of `protein`, `carbs`, and `fat` are defined on the entry. When any macro field is undefined, the row MUST show calories only — the system MUST NOT render placeholder zeros for missing macro values.

#### Scenario: Full entry shows macros
- **GIVEN** a full entry with `macrosPerUnit = { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 }` and `amount = 200`
- **WHEN** the entry row renders
- **THEN** the row shows `500 kcal · 52g P · 0g K · 30g F`

#### Scenario: Quick entry with full macros shows macros
- **GIVEN** a quick entry with `calories = 250`, `protein = 20`, `carbs = 15`, `fat = 10`
- **WHEN** the entry row renders
- **THEN** the row shows `250 kcal · 20g P · 15g K · 10g F`

#### Scenario: Quick entry without macros shows calories only
- **GIVEN** a quick entry with `calories = 80` and no `protein`, `carbs`, or `fat` fields
- **WHEN** the entry row renders
- **THEN** the row shows `80 kcal` and no macro suffix

#### Scenario: Quick entry with partial macros shows calories only
- **GIVEN** a quick entry with `calories = 80` and `protein = 5`, but no `carbs` or `fat`
- **WHEN** the entry row renders
- **THEN** the row shows `80 kcal` and no macro suffix (the system MUST NOT fabricate zeros)

### Requirement: Per-entry calories and macros update live with the inline amount input
The system SHALL update the displayed calories and macros of a full entry row immediately when the user edits that row's inline amount input, before the debounced PATCH request is sent. The displayed values MUST be derived from the parsed input value while it is a valid positive amount; when the input is empty or below the minimum, the row MUST fall back to the persisted `ingredient.amount`.

This requirement applies only to full entries (which carry an inline amount input). Quick entries have no amount input and are unaffected.

#### Scenario: Live update while typing
- **GIVEN** a full entry with `macrosPerUnit = { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 }` and persisted `amount = 100` (row reads `165 kcal · 31g P · 0g K · 4g F`)
- **WHEN** the user types `250` into the row's inline amount input
- **THEN** the row immediately reads `413 kcal · 78g P · 0g K · 9g F`, before any PATCH request is sent

#### Scenario: Empty input falls back to persisted amount
- **GIVEN** a full entry with persisted `amount = 100`
- **WHEN** the user clears the inline amount input
- **THEN** the row continues to display calories and macros computed from `amount = 100` (no `NaN`, no zero placeholder)

### Requirement: Slot card shows slot total calories and macros
The system SHALL display each meal slot's aggregated calories and macros in the slot card header on the daily log screen. The slot total MUST be visually distinct from the slot title and from the per-entry totals, and MUST be readable without horizontal scrolling on a 360px-wide viewport.

The calorie total MUST be rounded to the nearest integer and suffixed with `kcal`.

The macro total MUST follow the format `· {P}g P · {C}g K · {F}g F` (integer-rounded), and MUST be suppressed when:
- The slot has zero entries, OR
- The slot's `totals.calories` is zero, OR
- All three of `totals.protein`, `totals.carbs`, `totals.fat` are zero, OR
- The slot's `totals.macrosPartial` is `true` (i.e. at least one quick entry in the slot has no macro breakdown).

When the macro total is suppressed due to `macrosPartial`, the calorie total MUST still be shown.

#### Scenario: Empty slot shows no totals
- **GIVEN** a slot with no entries
- **WHEN** the slot card renders
- **THEN** the slot header shows no kcal value and no macro line

#### Scenario: Slot with full entries shows kcal and macros
- **GIVEN** a slot whose aggregated totals are `{ calories: 540, protein: 32, carbs: 60, fat: 18, macrosPartial: false }`
- **WHEN** the slot card renders
- **THEN** the header shows `540 kcal` and `· 32g P · 60g K · 18g F`

#### Scenario: Slot with partial macros shows kcal only
- **GIVEN** a slot containing at least one quick entry with no macro fields, totals `{ calories: 340, protein: 10, carbs: 0, fat: 0, macrosPartial: true }`
- **WHEN** the slot card renders
- **THEN** the header shows `340 kcal` and no macro line

### Requirement: Daily log display reuses computed totals, never recomputes
The system SHALL use the `SlotSummary.totals` returned by the `GET /daily-log` response when rendering slot-level kcal and macros. The frontend MUST NOT independently re-sum entries to derive slot totals, because slot totals and the `macrosPartial` flag are an authoritative concern of the backend `getDailyLog` use case.

Per-entry rendering (kcal and macros) MAY be computed in the UI from the entry's own `ingredient` fields, because no equivalent per-entry pre-computed shape exists on the wire.

#### Scenario: Slot totals come from the API response
- **WHEN** the daily log screen renders a slot
- **THEN** the kcal and macro values displayed in the slot header are taken directly from `SlotSummary.totals` returned by the API

