## ADDED Requirements

### Requirement: OFF nutrient mapping uses only the per-100g basis

The Open Food Facts adapter SHALL map every nutrient (`energy-kcal`, `proteins`, `carbohydrates`, `fat`) exclusively from the `_100g` suffixed fields of the OFF `nutriments` object. The adapter MUST NOT read any `_serving` suffixed nutrient field, which is community-contributed and frequently missing. The resulting `macrosPerUnit` SHALL remain the per-gram values derived from the per-100g figures (each per-100g value divided by 100), unchanged from current behavior.

#### Scenario: Nutrients read from _100g fields

- **WHEN** an OFF product is mapped whose `nutriments` contains `energy-kcal_100g: 250`, `proteins_100g: 8`, `carbohydrates_100g: 50`, `fat_100g: 4`
- **THEN** the result's `macrosPerUnit` is `{ calories: 2.5, protein: 0.08, carbs: 0.5, fat: 0.04 }`

#### Scenario: _serving nutrient fields are ignored

- **WHEN** an OFF product is mapped whose `nutriments` contains both `energy-kcal_100g: 250` and a conflicting `energy-kcal_serving: 999`
- **THEN** `macrosPerUnit.calories` is computed from the `_100g` value (`2.5`) and the `_serving` value has no effect on the result

### Requirement: OFF results carry optional serving size and quantity

The Open Food Facts adapter SHALL request the product-level `serving_size` and `serving_quantity` fields and SHALL populate `IngredientSearchResult.servingSize` (string) and `IngredientSearchResult.servingQuantity` (number, grams of one serving) when present and valid on the OFF product. Both fields are optional: when the OFF product omits a field, or `serving_quantity` is not a finite positive number, the corresponding result field SHALL be left undefined rather than defaulted. These fields are additive metadata and SHALL NOT influence `macrosPerUnit` or any macro calculation.

#### Scenario: Serving fields populated from OFF product

- **WHEN** an OFF product is mapped with `serving_size: "1 slice (25g)"` and `serving_quantity: 25`
- **THEN** the result has `servingSize: "1 slice (25g)"` and `servingQuantity: 25`, and `macrosPerUnit` is unaffected by these fields

#### Scenario: Missing serving data leaves fields undefined

- **WHEN** an OFF product is mapped with no `serving_size` and no `serving_quantity`
- **THEN** the result's `servingSize` and `servingQuantity` are both undefined

#### Scenario: Invalid serving quantity leaves field undefined

- **WHEN** an OFF product is mapped with `serving_quantity: 0` (or a non-numeric / negative value)
- **THEN** the result's `servingQuantity` is undefined

### Requirement: Gram input pre-fills with serving quantity when available

In the log-ingredient confirm flow, when the selected `IngredientSearchResult` carries a finite positive `servingQuantity` and no other amount default applies, the gram input SHALL be pre-filled with that serving quantity. A caller-supplied default amount (e.g. the `lastAmount` from the recently-used flow) SHALL take precedence over `servingQuantity`. When neither a caller default nor a `servingQuantity` is present, the input SHALL start empty, as before. Pre-filling SHALL NOT change the macro calculation, which remains `macrosPerUnit × amount`.

#### Scenario: Serving quantity pre-fills the gram input

- **WHEN** the user selects an OFF result with `servingQuantity: 25` from search and no caller-supplied default amount is provided
- **THEN** the confirm screen's gram input is pre-filled with `25`

#### Scenario: Caller default amount wins over serving quantity

- **WHEN** the user re-logs a recently-used ingredient that resolves to a result with `servingQuantity: 25` but the recent flow supplies a `lastAmount` of `80`
- **THEN** the gram input is pre-filled with `80`

#### Scenario: No serving quantity leaves the input empty

- **WHEN** the user selects a result with no `servingQuantity` and no caller-supplied default amount
- **THEN** the gram input starts empty
