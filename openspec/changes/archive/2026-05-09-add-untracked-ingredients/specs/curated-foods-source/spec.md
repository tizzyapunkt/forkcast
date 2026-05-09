## MODIFIED Requirements

### Requirement: Each food entry has a canonical name, synonyms, macros, unit, and optional piece weights

Each entry in `foods.json` SHALL have:

- `id`: a stable, lowercase, ASCII kebab-case identifier (e.g. `moehre`, `huehnchenbrust`).
- `name`: the canonical display name in German (e.g. `Möhre`, `Hähnchenbrust`).
- `synonyms`: an array (possibly empty) of alternate names; entries MAY mix German and English (e.g. `["Karotte", "carrot", "Mohrrübe"]`). The canonical `name` MUST NOT appear in `synonyms`.
- `unit`: either `'g'` or `'ml'`. `'ml'` SHALL only be used for entries that are naturally measured by volume (e.g. milk, oils).
- `macrosPer100`: an object with finite non-negative `calories`, `protein`, `carbs`, and `fat` values per 100 of `unit`.
- `pieces`: an OPTIONAL array of `{ label: string; grams: number }` objects describing typical piece weights (e.g. `[{ label: "klein", grams: 80 }, { label: "mittel", grams: 110 }]`). Each `label` SHALL be unique within an entry. Each `grams` SHALL be a positive finite number. The field SHALL be omitted entirely (not an empty array) when no piece-weight reference applies.
- `untracked`: an OPTIONAL boolean flag. When `true`, the entry represents a seasoning, herb, spice, or other ingredient that is real (used in recipes, eligible for the future grocery list) but contributes nothing to nutrition rollups. When `untracked: true`, `macrosPer100` MUST equal `{ calories: 0, protein: 0, carbs: 0, fat: 0 }` exactly. The field SHALL be omitted entirely (not set to `false`) when the entry is tracked.

#### Scenario: Entry with piece weights validates

- **WHEN** an entry is `{ id: "moehre", name: "Möhre", synonyms: ["Karotte", "carrot"], unit: "g", macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 }, pieces: [{ label: "mittel", grams: 75 }] }`
- **THEN** the entry passes validation and is loaded into the in-memory index

#### Scenario: Entry without piece weights validates

- **WHEN** an entry is `{ id: "olivenoel", name: "Olivenöl", synonyms: ["olive oil"], unit: "ml", macrosPer100: { calories: 884, protein: 0, carbs: 0, fat: 100 } }`
- **THEN** the entry passes validation with no `pieces` field

#### Scenario: Entry with non-positive piece weight fails validation

- **WHEN** an entry has `pieces: [{ label: "klein", grams: 0 }]`
- **THEN** the entry is rejected at load time and a warning is logged

#### Scenario: Canonical name appearing in synonyms fails validation

- **WHEN** an entry has `name: "Möhre"` and `synonyms: ["Möhre", "Karotte"]` (case-insensitive equal)
- **THEN** the entry is rejected at load time and a warning is logged

#### Scenario: Untracked entry with zero macros validates

- **WHEN** an entry is `{ id: "salz", name: "Salz", synonyms: ["Speisesalz", "salt"], unit: "g", macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 }, untracked: true }`
- **THEN** the entry passes validation and is loaded into the in-memory index with `untracked: true` retained

#### Scenario: Untracked entry with non-zero macros fails validation

- **WHEN** an entry has `untracked: true` and `macrosPer100.calories` is `12` (or any other non-zero value)
- **THEN** the entry is rejected at load time and a warning is logged

#### Scenario: Tracked entry omits the untracked field

- **WHEN** an entry has `macrosPer100` with non-zero values and the `untracked` field is absent
- **THEN** the entry passes validation as a tracked entry

### Requirement: FOODS search results carry source attribution and macros

Each FOODS result SHALL conform to the shared `IngredientSearchResult` shape with `source: 'FOODS'`, `id` set to the entry's id, `unit` set to the entry's `unit` (`'g'` or `'ml'`), and `macrosPerUnit` derived by dividing the per-100 values by 100 for `calories`, `protein`, `carbs`, and `fat`. The `name` field SHALL be the entry's canonical `name`.

When the underlying FOODS entry has `untracked: true`, the result SHALL also carry `untracked: true`. When the underlying FOODS entry is tracked, the result SHALL carry `untracked: false` or omit the field; consumers MUST treat absent and `false` as equivalent.

#### Scenario: Result shape includes source, id, and unit

- **WHEN** any FOODS entry is returned from `searchByName`
- **THEN** the result has `source === 'FOODS'`, `id` equal to the entry's id, `unit` equal to the entry's unit, and `macrosPerUnit` populated

#### Scenario: Macros are scaled per gram or millilitre

- **WHEN** an entry has `unit: "g"` and `macrosPer100 = { calories: 250, protein: 10, carbs: 0, fat: 23 }`
- **THEN** the returned `macrosPerUnit` has `calories === 2.5`, `protein === 0.1`, `carbs === 0`, and `fat === 0.23`

#### Scenario: Untracked flag carried through to result

- **WHEN** a FOODS entry with `untracked: true` matches a query
- **THEN** the returned result carries `untracked: true` so consumers can render and gate appropriately

#### Scenario: Tracked result has no untracked flag set

- **WHEN** a FOODS entry without an `untracked` field matches a query
- **THEN** the returned result either omits `untracked` or sets it to `false`

### Requirement: Curated dataset is generated by an AI build script with a curated key list

The repository SHALL ship a TypeScript build script (`backend/scripts/build-foods-data.ts`) that reads a curated, hand-edited list of food keys (`backend/scripts/foods-seed-keys.ts`) and produces `backend/data/foods.json`. The seed-key list SHALL accept entries in either of two forms:

- a plain `string` — the canonical key for a tracked entry; or
- an object `{ key: string; untracked: true }` — a key that MUST be generated as an untracked entry.

The script SHALL:

- Call the Anthropic API (using the `ANTHROPIC_API_KEY` environment variable) with a tool-use schema mirroring `FoodEntry`.
- Process keys in batches small enough to fit one batch's response in a single tool call (target 20 keys per call).
- Produce one entry per input key. If the AI cannot return a valid entry for a key, the script SHALL fail the run and exit non-zero with a message naming the key.
- For keys marked `untracked` in the seed list, instruct the model to set `untracked: true` and `macrosPer100` to all-zeros, AND post-validate that the returned entry has `untracked: true` and zero macros — failing the run with a message naming the offending key if not.
- Sort the output entries by `id` ascending before writing.
- Validate every output entry against the requirements above (canonical name, synonyms shape, unit, macros, optional pieces, optional untracked) and fail the run if any entry fails validation.
- Write the output as pretty-printed JSON ending in a single trailing newline so diffs are reviewable in PRs.

The committed `foods.json` SHALL be considered the source of truth; re-running the script overwrites the file. The script SHALL NOT be invoked at server startup.

#### Scenario: Build script regenerates foods.json from the seed keys

- **WHEN** a contributor runs `pnpm --filter @forkcast/backend build:foods` with `ANTHROPIC_API_KEY` set
- **THEN** the script produces `backend/data/foods.json` containing one entry per key in `foods-seed-keys.ts`, sorted by `id`, ending with a single trailing newline

#### Scenario: Build script fails fast on validation error

- **WHEN** the AI returns an entry with `macrosPer100.calories` set to a negative number
- **THEN** the script exits non-zero with a message identifying the offending entry's `id` and writes nothing

#### Scenario: Build script fails when a seed key has no AI response

- **WHEN** a batch response is missing one of the requested ids
- **THEN** the script exits non-zero with a message naming the missing key and writes nothing

#### Scenario: Untracked seed key produces an untracked entry

- **WHEN** the seed list contains `{ key: "salz", untracked: true }` and the AI returns the entry as instructed
- **THEN** `foods.json` contains an entry with `id: "salz"`, `untracked: true`, and zero `macrosPer100` values

#### Scenario: Build script rejects mismatched untracked output

- **WHEN** the seed list marks `pfeffer` as untracked but the AI returns `pfeffer` with non-zero macros or without `untracked: true`
- **THEN** the script exits non-zero with a message naming `pfeffer` and writes nothing

## ADDED Requirements

### Requirement: Curated dataset includes the user's seasoning, herb, and spice shortlist

The seed-key list SHALL include the common seasoning, herb, and spice entries the user cooks with — at minimum salt, black pepper, and a small set of common Mediterranean herbs and spices (e.g. basil, oregano, thyme, rosemary, paprika). Each such entry SHALL be marked `untracked: true` in the seed list and therefore in the generated `foods.json`. The exact list MAY be extended over time without spec changes.

#### Scenario: Salt and pepper present and untracked

- **WHEN** the backend boots after a fresh `build:foods` run
- **THEN** `foods.json` contains entries for `salz` and `pfeffer` (or equivalents), both with `untracked: true` and zero `macrosPer100`

#### Scenario: Common herbs and spices searchable

- **WHEN** the user searches for `basilikum` (or `basil`)
- **THEN** the FOODS service returns a result with `untracked: true`
