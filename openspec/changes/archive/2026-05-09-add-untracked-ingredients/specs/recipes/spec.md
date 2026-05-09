## MODIFIED Requirements

### Requirement: Recipe entity shape
The system SHALL model a `Recipe` as an aggregate consisting of `id` (string), `name` (non-empty string), `yield` (positive integer representing the number of portions the recipe produces), `ingredients` (ordered list of full ingredients — `{ name, unit, macrosPerUnit, amount, pieceQuantity?, untracked? }`), `steps` (ordered list of non-empty strings, each describing one cooking step), `createdAt` (ISO datetime), and `updatedAt` (ISO datetime).

A recipe MUST have at least one ingredient. Steps MAY be empty (a recipe with no steps is a pure ingredient batch).

`pieceQuantity` is optional. When present it has the shape `{ amount: number, unitLabel: string, gramsPerPiece: number }` where `amount` is the count as written (positive number, may be fractional), `unitLabel` is the free-text noun the recipe used for the piece (e.g. `"onion"`, `"medium zucchini"`, `"clove"`), and `gramsPerPiece` is the canonical mass of one piece in the ingredient's `unit` (positive number). When `pieceQuantity` is present the ingredient's `unit` MUST be `g` or `ml`, and the invariant `amount === pieceQuantity.amount * pieceQuantity.gramsPerPiece` MUST hold (within a small floating-point tolerance) at the time of validation.

`untracked` is an optional boolean flag, defaulting to `false` (or absent — semantically equivalent). When `true`, the ingredient is part of the recipe (and its identity, instructions, and any future grocery list) but MUST NOT contribute to nutrition rollups anywhere in the system. Untracked ingredients MUST otherwise validate identically to tracked ingredients (`amount` is still required, `pieceQuantity` invariants still hold, `unit` rules still apply, `macrosPerUnit` is still part of the persisted shape — its values are simply ignored at consume time).

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
- **WHEN** the recipe store contains a recipe whose ingredients have no `pieceQuantity` field and no `untracked` field
- **THEN** the recipe loads successfully and is returned with `pieceQuantity` and `untracked` absent on those ingredients

#### Scenario: Recipe with untracked ingredient
- **WHEN** a recipe is created with an ingredient `{ name: "Salz", unit: "g", amount: 5, macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 }, untracked: true }`
- **THEN** the recipe is accepted and persisted with `untracked: true` intact on that ingredient

#### Scenario: Untracked flag accepts any macrosPerUnit values
- **WHEN** a recipe is created with an ingredient marked `untracked: true` whose `macrosPerUnit` carries non-zero values
- **THEN** the recipe is accepted (the flag is the source of truth; values are ignored at rollup time)

#### Scenario: Untracked still requires amount and unit
- **WHEN** a recipe is created with an ingredient that has `untracked: true` but no `amount` or no `unit`
- **THEN** the system rejects the request with a validation error — untracked ingredients are still real recipe ingredients

### Requirement: Recipes UI — list and create
The frontend SHALL provide a Recipes screen, reachable from the bottom navigation, that lists all recipes and exposes a "New recipe" affordance. The recipe form MUST allow entering `name`, `yield`, an ordered list of ingredients (each via the same ingredient picker the log drawer uses), and an ordered list of steps (free-text per step). Saving the form invokes the add-recipe command.

For each ingredient row, the form SHALL render the piece quantity alongside the mass amount when `pieceQuantity` is present (e.g. `1 Zwiebel (≈ 150 g)`), and SHALL allow editing both the piece count and the gram-weight-per-piece. Editing the piece count MUST recompute the mass `amount` using the existing `gramsPerPiece`. Editing `gramsPerPiece` MUST recompute the mass `amount` using the existing piece count. Editing the mass `amount` directly MUST detach the row from piece tracking by clearing `pieceQuantity`, with a visible inline hint warning the user that the piece count will be removed.

For each ingredient row in the manual recipe form, the editor SHALL render an `untracked` toggle ("Don't track" / "Untracked") that controls the row's `untracked` flag. The initial value of the flag on a newly added row depends on the source picked in the ingredient picker:

- A FOODS result with `untracked: true` MUST initialize the new row with `untracked: true`.
- A FOODS result without an `untracked` flag (or with `untracked: false`) MUST initialize the new row with `untracked: false`.
- An OFF (Open Food Facts) result MUST initialize the new row with `untracked: false`.

The toggle on every row MUST allow the user to override the inherited or default value in either direction at any time before saving. Rows with `untracked: true` MUST be visually distinguished from tracked rows (muted styling and/or a small badge) so the recipe's macro story is scannable at a glance.

#### Scenario: Empty state
- **WHEN** the user opens the Recipes screen and no recipes exist
- **THEN** an empty state with a "New recipe" call-to-action is shown

#### Scenario: Create from screen
- **WHEN** the user fills the recipe form with a name, yield, at least one ingredient, and zero or more steps, then submits
- **THEN** the recipe is added, the form closes, and the recipe appears in the list

#### Scenario: Validation feedback
- **WHEN** the user attempts to save a recipe with a missing name or no ingredients
- **THEN** the form surfaces inline validation errors and does not submit

#### Scenario: Edit piece count recomputes weight
- **WHEN** an ingredient row shows `1 Zwiebel (≈ 150 g)` with `gramsPerPiece = 150` and the user changes the piece count to `2`
- **THEN** the row updates to `2 Zwiebel (≈ 300 g)` and the underlying `amount` becomes `300`

#### Scenario: Edit grams-per-piece recomputes weight
- **WHEN** an ingredient row shows `1 Zwiebel (≈ 150 g)` and the user edits `gramsPerPiece` to `200`
- **THEN** the row updates to `1 Zwiebel (≈ 200 g)` and the underlying `amount` becomes `200`

#### Scenario: Edit mass amount detaches piece info
- **WHEN** an ingredient row shows `1 Zwiebel (≈ 150 g)` and the user edits the mass amount directly to `120`
- **THEN** the form shows an inline hint that the piece count will be removed; on confirm the row becomes a mass-only `120 g` row with `pieceQuantity` cleared

#### Scenario: Picking a FOODS-untracked entry initializes row as untracked
- **WHEN** the user picks a FOODS entry whose `untracked: true` (e.g. "Salz") in the manual recipe form's ingredient picker
- **THEN** the new ingredient row is rendered with the untracked toggle in the on state and visually muted

#### Scenario: Picking a tracked FOODS or OFF entry initializes row as tracked
- **WHEN** the user picks a tracked FOODS entry (e.g. "Hähnchenbrust") or an OFF result in the manual recipe form's ingredient picker
- **THEN** the new ingredient row is rendered with the untracked toggle in the off state and the standard tracked styling

#### Scenario: User toggles a tracked row to untracked in the manual form
- **WHEN** the user opens the recipe form, picks a tracked entry, and toggles "Don't track" on its row
- **THEN** the row's `untracked` becomes `true` in form state and the row's visual treatment switches to muted

#### Scenario: User clears an inherited untracked flag in the manual form
- **WHEN** the user picks a FOODS-untracked entry and toggles "Don't track" off on its row
- **THEN** the row's `untracked` becomes `false` in form state and the row's visual treatment switches back to tracked styling

#### Scenario: Untracked flag persists on save
- **WHEN** the user saves a manually-authored recipe whose form contains both tracked and untracked rows
- **THEN** the persisted recipe carries `untracked: true` on the appropriate rows and `untracked: false` (or absent) on the rest

#### Scenario: Editing an existing recipe preserves and toggles untracked
- **WHEN** the user opens an existing recipe in edit mode, where one row has `untracked: true` and another has `untracked: false`, and toggles the second row to untracked before saving
- **THEN** the update-recipe payload reflects both rows' final `untracked` values, and the persisted recipe carries them

### Requirement: Recipes UI — edit and delete
From the recipes list, the user SHALL be able to open a recipe and either view it (read mode showing ingredients and cooking steps), edit it (mutates name/yield/ingredients/steps, saves via update-recipe), or delete it (with a confirm step).

In read mode, ingredients with a `pieceQuantity` MUST be rendered in dual form (e.g. `1 Zwiebel (≈ 150 g)`); ingredients without a `pieceQuantity` MUST be rendered as today (`amount unit`).

In read mode, ingredients with `untracked: true` MUST be rendered inline in the ordered ingredient list (NOT split into a separate section), with a visual distinction (muted text and/or a small "untracked" badge) so the user can tell at a glance which rows count toward macros. Tracked and untracked rows MUST share the same row layout otherwise.

#### Scenario: Edit a recipe
- **WHEN** the user opens a recipe, switches to edit mode, modifies a field, and saves
- **THEN** the update-recipe command is sent and the list reflects the change

#### Scenario: Delete with confirmation
- **WHEN** the user taps "Delete" on a recipe
- **THEN** a confirmation prompt is shown; only on confirm is the delete-recipe command sent

#### Scenario: Cooking view
- **WHEN** the user opens a recipe in read mode
- **THEN** the screen shows the recipe name, yield, the ingredient list with amounts and units, and the ordered cooking steps

#### Scenario: Cooking view shows piece quantities
- **WHEN** the user opens a recipe whose ingredient list includes a row with `pieceQuantity = { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }` and `amount = 150`, `unit = "g"`
- **THEN** the row is rendered as `1 Zwiebel (≈ 150 g)` (or the equivalent localized label)

#### Scenario: Cooking view distinguishes untracked rows
- **WHEN** the user opens a recipe whose ingredient list contains both tracked and untracked rows
- **THEN** untracked rows appear in their original position in the ordered list with a visual distinction (muted styling and/or a badge), while tracked rows render as today
