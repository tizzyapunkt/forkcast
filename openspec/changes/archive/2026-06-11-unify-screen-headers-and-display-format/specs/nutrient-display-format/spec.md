# nutrient-display-format — delta

## MODIFIED Requirements

### Requirement: Picker rows display nutrient density per 100 of mass or volume units

Ingredient picker UIs (search results, recent items, and the full-entry confirm step) SHALL display nutrient density per 100 of the row's unit when that unit is a base mass (`g`) or volume (`ml`). The numeric value displayed MUST equal the underlying per-unit value multiplied by 100. The denominator label MUST be `100g` or `100ml` respectively.

On the full-entry confirm step, the per-100 macro values MUST be presented as the unified macro triplet `{P} P · {KH} KH · {F} F` (middot separators, carbs labelled `KH`, integer-rounded values without a `g` suffix) following the kcal-rate figure. The kcal-rate figure itself keeps the slash denominator (`{kcal} kcal / 100{unit}`) — it is a rate, not a macro triplet.

#### Scenario: Solid food in search results

- **WHEN** an ingredient with `unit: 'g'` and `macrosPerUnit.calories: 3.7` is rendered in the search-panel row
- **THEN** the row displays `370 kcal / 100g`

#### Scenario: Liquid food in search results

- **WHEN** an ingredient with `unit: 'ml'` and `macrosPerUnit.calories: 0.47` is rendered in the search-panel row
- **THEN** the row displays `47 kcal / 100ml`

#### Scenario: Recent items list mirrors the same format

- **WHEN** a recently-used ingredient with `unit: 'g'` and `macrosPerUnit.calories: 3.7` is rendered in the recent-panel row
- **THEN** the row displays `370 kcal / 100g`

#### Scenario: Full-entry confirm shows all four macros per 100

- **WHEN** the confirm step renders an ingredient with `unit: 'g'` and `macrosPerUnit: { calories: 3.7, protein: 0.13, carbs: 0.66, fat: 0.07 }`
- **THEN** the per-unit readout displays `370 kcal / 100g · 13 P · 66 KH · 7 F`
