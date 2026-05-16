## MODIFIED Requirements

### Requirement: Recipe entity shape
The system SHALL model a `Recipe` as an aggregate consisting of `id` (string), `name` (non-empty string), `yield` (positive integer representing the number of portions the recipe produces), `ingredients` (ordered list of full ingredients — `{ name, unit, macrosPerUnit, amount, pieceQuantity?, untracked?, displayQuantity?, note? }`), `steps` (ordered list of non-empty strings, each describing one cooking step), `createdAt` (ISO datetime), and `updatedAt` (ISO datetime).

A recipe MUST have at least one ingredient. Steps MAY be empty (a recipe with no steps is a pure ingredient batch).

`pieceQuantity` is optional. When present it has the shape `{ amount: number, unitLabel: string, gramsPerPiece: number }` where `amount` is the count as written (positive number, may be fractional), `unitLabel` is the free-text noun the recipe used for the piece (e.g. `"onion"`, `"medium zucchini"`, `"clove"`), and `gramsPerPiece` is the canonical mass of one piece in the ingredient's `unit` (positive number). When `pieceQuantity` is present the ingredient's `unit` MUST be `g` or `ml`, and the invariant `amount === pieceQuantity.amount * pieceQuantity.gramsPerPiece` MUST hold (within a small floating-point tolerance) at the time of validation.

`untracked` is an optional boolean flag, defaulting to `false` (or absent — semantically equivalent). When `true`, the ingredient is part of the recipe (and its identity, instructions, and any future grocery list) but MUST NOT contribute to nutrition rollups anywhere in the system. Untracked ingredients MUST still carry a valid `unit` from the enum and a finite `amount >= 0` (the `amount > 0` rule that applies to tracked rows is relaxed to `amount >= 0` for untracked rows so that AI-imported seasonings with no extracted quantity can be persisted as `amount = 0` and surfaced for manual completion). `macrosPerUnit` remains part of the persisted shape — its values are simply ignored at consume time.

`displayQuantity` is optional and MAY be present only when `untracked === true`. When present it has the shape `{ amount: number, unitLabel: string }` where `amount` is a finite non-negative number (fractional allowed) and `unitLabel` is a free-text, non-empty trimmed string of at most 24 characters. The validator MUST reject `displayQuantity` on a tracked row. `displayQuantity` is the source of truth for the rendered quantity on untracked rows wherever those rows are displayed (recipe form, recipes list, recipe read view); the canonical `amount` and `unit` remain stored on the row for shape stability.

`note` is optional and MAY appear on any ingredient row regardless of `untracked`. When present it is a free-text string carrying a short qualifier about the ingredient — typically a preparation, cut, or quality modifier (e.g. `"fein gehackt"`, `"geschält"`, `"in Scheiben"`). Detailed shape and validation rules are defined in "Ingredient note field". `note` MUST NOT affect ingredient matching, nutrition rollups, or any downstream calculation; it is a presentational/authoring field only.

#### Scenario: Minimal valid recipe
- **WHEN** a recipe is created with `name="Oats Bowl"`, `yield=1`, one ingredient, and no steps
- **THEN** the recipe is accepted and persisted with `steps=[]`

#### Scenario: Recipe with steps
- **WHEN** a recipe is created with `name="Bolognese"`, `yield=4`, multiple ingredients, and three steps
- **THEN** the recipe is accepted and the steps are stored in the given order

#### Scenario: Empty ingredient list rejected
- **WHEN** a recipe is created with no ingredients
- **THEN** the system rejects the request with a validation error and does not persist anything

#### Scenario: Empty name rejected
- **WHEN** a recipe is created with an empty or whitespace-only `name`
- **THEN** the system rejects the request with a validation error

#### Scenario: Non-positive yield rejected
- **WHEN** a recipe is created with `yield=0` or `yield=-1`
- **THEN** the system rejects the request with a validation error

#### Scenario: Recipe with piece-tracked ingredient
- **WHEN** a recipe is created with an ingredient `{ name: "Zwiebel", unit: "g", amount: 150, macrosPerUnit, pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 } }`
- **THEN** the recipe is accepted and persisted with the `pieceQuantity` field intact on that ingredient

#### Scenario: pieceQuantity inconsistent with amount rejected
- **WHEN** a recipe is created with an ingredient where `amount = 200`, `pieceQuantity.amount = 1`, and `pieceQuantity.gramsPerPiece = 150`
- **THEN** the system rejects the request with a validation error indicating that the piece quantity does not match the total amount

#### Scenario: pieceQuantity with non-mass unit rejected
- **WHEN** a recipe is created with an ingredient where `unit = "tbsp"` and `pieceQuantity` is set
- **THEN** the system rejects the request with a validation error indicating that piece quantities require a mass unit (`g` or `ml`)

#### Scenario: Backwards-compatible read of legacy ingredient
- **WHEN** the recipe store contains a recipe whose ingredients have no `pieceQuantity`, no `untracked`, no `displayQuantity`, and no `note` field
- **THEN** the recipe loads successfully and is returned with those fields absent on those ingredients

#### Scenario: Recipe with untracked ingredient
- **WHEN** a recipe is created with an ingredient `{ name: "Salz", unit: "g", amount: 5, macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 }, untracked: true }`
- **THEN** the recipe is accepted and persisted with `untracked: true` intact on that ingredient

#### Scenario: Untracked flag accepts any macrosPerUnit values
- **WHEN** a recipe is created with an ingredient marked `untracked: true` whose `macrosPerUnit` carries non-zero values
- **THEN** the recipe is accepted (the flag is the source of truth; values are ignored at rollup time)

#### Scenario: Untracked allows amount zero
- **WHEN** a recipe is created with an untracked ingredient whose `amount = 0` and a valid `unit`
- **THEN** the recipe is accepted and persisted with `amount = 0` intact

#### Scenario: Untracked rejects negative amount
- **WHEN** a recipe is created with an untracked ingredient whose `amount` is negative
- **THEN** the system rejects the request with a validation error

#### Scenario: Untracked still requires unit
- **WHEN** a recipe is created with an untracked ingredient that has no `unit`
- **THEN** the system rejects the request with a validation error

#### Scenario: Tracked still rejects amount zero
- **WHEN** a recipe is created with a tracked ingredient whose `amount = 0`
- **THEN** the system rejects the request with a validation error indicating tracked rows require a positive amount

#### Scenario: Recipe with untracked displayQuantity
- **WHEN** a recipe is created with an ingredient `{ name: "Salz", unit: "g", amount: 0, macrosPerUnit, untracked: true, displayQuantity: { amount: 1, unitLabel: "TL" } }`
- **THEN** the recipe is accepted and persisted with `displayQuantity: { amount: 1, unitLabel: "TL" }` intact on that row

#### Scenario: displayQuantity on tracked row rejected
- **WHEN** a recipe is created with an ingredient that has `untracked` absent or `false` and a `displayQuantity` set
- **THEN** the system rejects the request with a validation error indicating `displayQuantity` is only allowed on untracked rows

#### Scenario: displayQuantity with empty unitLabel rejected
- **WHEN** a recipe is created with an untracked ingredient whose `displayQuantity.unitLabel` is empty after trim
- **THEN** the system rejects the request with a validation error

#### Scenario: displayQuantity with overlong unitLabel rejected
- **WHEN** a recipe is created with an untracked ingredient whose `displayQuantity.unitLabel` exceeds 24 characters after trim
- **THEN** the system rejects the request with a validation error

#### Scenario: Recipe with ingredient note
- **WHEN** a recipe is created with an ingredient `{ name: "Ingwer", unit: "g", amount: 5, macrosPerUnit, note: "fein gehackt" }`
- **THEN** the recipe is accepted and persisted with `note: "fein gehackt"` intact on that ingredient

## ADDED Requirements

### Requirement: Ingredient note field
The system SHALL accept an optional `note?: string` field on every recipe ingredient row, on both `add-recipe` and `update-recipe` paths.

When present, `note` MUST be a string of trimmed length between 1 and 80 characters inclusive. Empty strings (after trim) MUST be rejected. Notes longer than 80 characters after trim MUST be rejected. The persisted value MUST be the trimmed form. The field MAY be present on tracked and untracked rows alike; it has no relationship with `untracked` or `displayQuantity` and does not affect their validation.

`note` MUST be absent on ingredient rows where the caller does not provide it. The serializer MUST NOT emit `note` on a row that does not carry one. Reading a recipe whose ingredient rows lack `note` MUST succeed and return those rows without the field.

`note` is a free-text qualifier intended for short preparation, cut, or quality modifiers (e.g. `"fein gehackt"`, `"geschält"`, `"in Scheiben"`). The system MUST NOT use `note` for ingredient matching, nutrition calculation, or any rollup. It is a presentational/authoring field, carried verbatim through save and read.

#### Scenario: Note on tracked ingredient accepted
- **WHEN** a recipe is created with a tracked ingredient `{ name: "Knoblauch", unit: "g", amount: 6, macrosPerUnit, note: "fein gehackt" }`
- **THEN** the recipe is accepted and persisted with `note: "fein gehackt"` on that ingredient

#### Scenario: Note on untracked ingredient accepted
- **WHEN** a recipe is created with an untracked ingredient `{ name: "Pfeffer", unit: "g", amount: 0, macrosPerUnit, untracked: true, displayQuantity: { amount: 1, unitLabel: "Prise" }, note: "frisch gemahlen" }`
- **THEN** the recipe is accepted and persisted with `note: "frisch gemahlen"` on that ingredient alongside the existing fields

#### Scenario: Empty note rejected
- **WHEN** a recipe is created with an ingredient whose `note` is an empty or whitespace-only string
- **THEN** the system rejects the request with a validation error indicating the note must be non-empty when present

#### Scenario: Overlong note rejected
- **WHEN** a recipe is created with an ingredient whose `note` exceeds 80 characters after trim
- **THEN** the system rejects the request with a validation error indicating the note must be at most 80 characters

#### Scenario: Note trimmed on persistence
- **WHEN** a recipe is created with an ingredient whose `note` is `"  fein gehackt  "` (with surrounding whitespace)
- **THEN** the recipe is persisted with `note: "fein gehackt"` (trimmed)

#### Scenario: Note omitted by default
- **WHEN** a recipe is created with an ingredient that does not carry a `note` field
- **THEN** the recipe is accepted and the persisted row has no `note` field on it

#### Scenario: Update recipe preserves and replaces notes
- **WHEN** an existing recipe is updated via `update-recipe` with one ingredient gaining a new `note`, one ingredient changing its `note`, and one ingredient dropping its previously-set `note` by omitting the field from the payload
- **THEN** the persisted recipe reflects all three changes — the first row carries the new note, the second carries the replacement, and the third has no `note` field

### Requirement: Recipe form ingredient note editor
The recipe form (used for both creating and editing recipes) SHALL allow the user to enter, edit, and clear an optional note on each ingredient row. The note input SHALL be rendered as a subtitle row beneath the ingredient name, visually distinct from the amount/unit controls.

When the user enters a note and saves, the form MUST send the trimmed value as `note` on that ingredient. When the user clears the note (leaving it empty after trim), the form MUST omit the `note` field from the saved payload — it MUST NOT send an empty string.

The note input MUST coexist with the existing `displayQuantity` subtitle on untracked rows — both MAY render simultaneously on the same row, on separate lines.

#### Scenario: Adding a note on a new ingredient row
- **WHEN** the user adds an ingredient via the picker and enters `"in dünne Scheiben geschnitten"` into the note subtitle input
- **THEN** saving the recipe persists that ingredient row with `note: "in dünne Scheiben geschnitten"`

#### Scenario: Editing an existing note
- **WHEN** the user opens an existing recipe with an ingredient note `"fein gehackt"`, changes it to `"grob gehackt"`, and saves
- **THEN** the persisted recipe carries the ingredient row with `note: "grob gehackt"`

#### Scenario: Clearing a note
- **WHEN** the user opens an existing recipe with an ingredient note and clears the note input (empty after trim) and saves
- **THEN** the persisted recipe carries the ingredient row without a `note` field
