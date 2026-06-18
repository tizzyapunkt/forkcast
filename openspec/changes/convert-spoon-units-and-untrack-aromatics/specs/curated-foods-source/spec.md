# curated-foods-source — delta

## ADDED Requirements

### Requirement: Food entries may carry a density for volume-to-mass conversion

Each entry in `foods.json` MAY include an OPTIONAL `density` field: a positive finite number giving the food's mass per millilitre (g/ml). The field exists so volume measures stated in a recipe (e.g. spoons) can be converted to the entry's mass `unit`. It SHALL be present only on `g`-unit foods that are realistically measured by volume (dry staples such as Speisestärke and flours); `ml`-unit foods do not need it (a volume measure already matches their unit), and most `g`-unit foods omit it. When present, `density` MUST be a positive finite number; the entry SHALL be rejected at load time with a logged warning otherwise. When absent, no volume conversion is attempted for that food.

#### Scenario: Entry with a valid density validates

- **WHEN** an entry is `{ id: "speisestärke", name: "Speisestärke", synonyms: ["cornstarch"], unit: "g", macrosPer100: { calories: 381, protein: 0.6, carbs: 91, fat: 0.1 }, density: 0.55 }`
- **THEN** the entry passes validation and is loaded into the in-memory index with `density: 0.55` retained

#### Scenario: Entry with a non-positive density fails validation

- **WHEN** an entry has `density: 0`
- **THEN** the entry is rejected at load time and a warning is logged

#### Scenario: Entry without a density validates

- **WHEN** an entry is `{ id: "moehre", name: "Möhre", synonyms: ["carrot"], unit: "g", macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 } }`
- **THEN** the entry passes validation with no `density` field

### Requirement: Low-signal aromatics are seeded untracked

The seed-key list SHALL mark `ingwer` and `knoblauch` as `untracked: true`, so their generated `foods.json` entries carry `untracked: true` and zero `macrosPer100`. These foods are nutritionally trivial in any culinary amount and are almost always stated in spoons or pieces; treating them as untracked keeps them in recipes and the future grocery list without polluting macro rollups. This is a per-food curated decision; it does NOT imply any amount-based untracking rule.

#### Scenario: Ginger and garlic present and untracked

- **WHEN** the backend boots after a fresh `build:foods` run
- **THEN** `foods.json` contains entries for `ingwer` and `knoblauch`, both with `untracked: true` and zero `macrosPer100`
