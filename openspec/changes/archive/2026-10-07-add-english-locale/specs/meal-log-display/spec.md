## MODIFIED Requirements

### Requirement: Daily log shows per-entry macros when available

The system SHALL display the protein, carbs, and fat contribution of every log entry alongside its calorie value when macro data is available for that entry. The macro suffix MUST follow the same compact inline format used by the slot summary: `· {P} P · {C} {carbsLabel} · {F} F` — middot separators, carbs labelled `KH` in the German locale and `C` in the English locale, each value rounded to the nearest integer, no `g` suffix on the values.

A `full` entry MUST always render its macro suffix, computed as `ingredient.macrosPerUnit.{protein,carbs,fat} * ingredient.amount`.

A `quick` entry MUST render its macro suffix only when **all three** of `protein`, `carbs`, and `fat` are defined on the entry. When any macro field is undefined, the row MUST show calories only — the system MUST NOT render placeholder zeros for missing macro values.

#### Scenario: Full entry shows macros

- **GIVEN** a full entry with `macrosPerUnit = { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 }` and `amount = 200`
- **WHEN** the entry row renders in the German locale
- **THEN** the row shows `500 kcal · 52 P · 0 KH · 30 F`

#### Scenario: Full entry shows macros in English

- **GIVEN** the same full entry
- **WHEN** the entry row renders in the English locale
- **THEN** the row shows `500 kcal · 52 P · 0 C · 30 F`

#### Scenario: Quick entry with full macros shows macros

- **GIVEN** a quick entry with `calories = 250`, `protein = 20`, `carbs = 15`, `fat = 10`
- **WHEN** the entry row renders in the German locale
- **THEN** the row shows `250 kcal · 20 P · 15 KH · 10 F`

#### Scenario: Quick entry without macros shows calories only

- **GIVEN** a quick entry with `calories = 80` and no `protein`, `carbs`, or `fat` fields
- **WHEN** the entry row renders
- **THEN** the row shows `80 kcal` and no macro suffix

#### Scenario: Quick entry with partial macros shows calories only

- **GIVEN** a quick entry with `calories = 80` and `protein = 5`, but no `carbs` or `fat`
- **WHEN** the entry row renders
- **THEN** the row shows `80 kcal` and no macro suffix (the system MUST NOT fabricate zeros)
