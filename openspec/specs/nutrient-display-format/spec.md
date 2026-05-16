# nutrient-display-format

## Purpose

Define the canonical display format for nutrient density in ingredient picker UIs (search, recent, full-entry confirm, recipe-form ingredient picker). The picker SHALL show per-100 values for mass and volume units (`100g`, `100ml`) to match how nutrition labels are conventionally read, while falling back to per-unit display for units where `100<unit>` is not meaningful (e.g. `piece`). Storage shape and display shape are decoupled: underlying values continue to be per-unit, and per-100 multiplication happens only at render time.

## Requirements

### Requirement: Picker rows display nutrient density per 100 of mass or volume units

Ingredient picker UIs (search results, recent items, and the full-entry confirm step) SHALL display nutrient density per 100 of the row's unit when that unit is a base mass (`g`) or volume (`ml`). The numeric value displayed MUST equal the underlying per-unit value multiplied by 100. The denominator label MUST be `100g` or `100ml` respectively.

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
- **THEN** the per-unit readout displays kcal as `370`, protein as `13g`, carbs as `66g`, and fat as `7g`, with denominator `100g`

### Requirement: Picker rows fall back to per-unit display for non-mass/volume units

When a picker row's unit is neither `g` nor `ml` (e.g. `piece`, `oz`, `cup`, `tbsp`, `tsp`), the row MUST display the underlying per-unit value as-is, with the unit itself as the denominator label (no `100` prefix). This prevents nonsensical denominators like `100piece`.

#### Scenario: Piece-based recent item

- **WHEN** a recently-used ingredient with `unit: 'piece'` and `macrosPerUnit.calories: 80` is rendered in the recent-panel row
- **THEN** the row displays `80 kcal / piece` (no `100` prefix, value unchanged)

#### Scenario: Full-entry confirm with a non-mass unit

- **WHEN** the confirm step renders an ingredient with `unit: 'piece'` and `macrosPerUnit.calories: 80`
- **THEN** the per-unit readout uses `piece` as the denominator label and shows the kcal value unchanged

### Requirement: Storage shape is decoupled from display shape

The per-100 display format MUST NOT change the on-disk or wire shape of `IngredientSearchResult.macrosPerUnit`, `LogEntry.ingredient.macrosPerUnit`, or recipe ingredient rows. Those fields continue to store per-unit values. Per-100 multiplication is a presentation concern only and happens at render time.

#### Scenario: Logged entry preserves per-unit storage

- **WHEN** a user picks an ingredient displayed as `370 kcal / 100g` and submits an amount of `80 g`
- **THEN** the persisted `LogEntry.ingredient.macrosPerUnit.calories` equals `3.7` (per-unit), not `370` (per-100)

#### Scenario: Wire format unchanged for search results

- **WHEN** the backend returns an ingredient search result for an item with 370 kcal per 100g
- **THEN** the JSON response carries `macrosPerUnit.calories: 3.7`, unchanged from prior behavior

### Requirement: Denominator label policy lives in a single i18n helper

The rule that decides between `100${unit}` and `${unit}` SHALL be implemented inside the i18n helpers (`searchPanel.kcalPer`, `recentPanel.kcalPer`, `fullEntry.perUnit`, `recipeIngredientPicker.perUnit`) and not duplicated at component call sites. Components MUST pass the raw per-unit value and the unit; the helper performs any multiplication and label construction.

#### Scenario: Helper applies the rule, not the component

- **WHEN** a component calls `kcalPer(0.47, 'ml')`
- **THEN** the helper returns the string `47 kcal / 100ml` — the component itself performs no multiplication
