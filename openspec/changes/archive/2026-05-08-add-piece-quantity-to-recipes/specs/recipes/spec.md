## MODIFIED Requirements

### Requirement: Recipe entity shape
The system SHALL model a `Recipe` as an aggregate consisting of `id` (string), `name` (non-empty string), `yield` (positive integer representing the number of portions the recipe produces), `ingredients` (ordered list of full ingredients — `{ name, unit, macrosPerUnit, amount, pieceQuantity? }`), `steps` (ordered list of non-empty strings, each describing one cooking step), `createdAt` (ISO datetime), and `updatedAt` (ISO datetime).

A recipe MUST have at least one ingredient. Steps MAY be empty (a recipe with no steps is a pure ingredient batch).

`pieceQuantity` is optional. When present it has the shape `{ amount: number, unitLabel: string, gramsPerPiece: number }` where `amount` is the count as written (positive number, may be fractional), `unitLabel` is the free-text noun the recipe used for the piece (e.g. `"onion"`, `"medium zucchini"`, `"clove"`), and `gramsPerPiece` is the canonical mass of one piece in the ingredient's `unit` (positive number). When `pieceQuantity` is present the ingredient's `unit` MUST be `g` or `ml`, and the invariant `amount === pieceQuantity.amount * pieceQuantity.gramsPerPiece` MUST hold (within a small floating-point tolerance) at the time of validation.

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
- **WHEN** the recipe store contains a recipe whose ingredients have no `pieceQuantity` field
- **THEN** the recipe loads successfully and is returned with `pieceQuantity` absent on those ingredients

### Requirement: Update recipe
The system SHALL expose a command to update a recipe's `name`, `yield`, `ingredients`, and/or `steps`. The command MUST accept partial updates: any field omitted is left unchanged. On success, `updatedAt` MUST be set to the current time and the updated recipe is returned. The same validation rules as creation apply to any field that is being updated (e.g. an `ingredients` update MUST contain at least one ingredient, and any `pieceQuantity` MUST satisfy the invariants on `Recipe entity shape`).

Updating a recipe MUST NOT modify any previously logged `LogEntry` records that reference it. Logged entries are independent snapshots.

#### Scenario: Rename a recipe
- **WHEN** a client sends `PATCH /recipe/:id` with body `{ "name": "Rocket Bolognese" }`
- **THEN** the recipe's `name` is updated, `updatedAt` advances, all other fields stay the same

#### Scenario: Update yield and ingredients atomically
- **WHEN** a client sends `PATCH /recipe/:id` with both `yield` and `ingredients`
- **THEN** both fields are updated together (or both reverted on validation failure)

#### Scenario: Update with invalid field
- **WHEN** a client sends `PATCH /recipe/:id` with `{ "yield": 0 }`
- **THEN** the response is `400` and the recipe is unchanged

#### Scenario: Update missing recipe
- **WHEN** a client sends `PATCH /recipe/:id` for an unknown `id`
- **THEN** the response is `404`

#### Scenario: Past logs untouched by update
- **WHEN** a recipe has been logged into the meal log and is then updated (e.g. an ingredient amount changes)
- **THEN** the previously created `LogEntry` rows retain their original `ingredient` snapshots

#### Scenario: Update ingredients with piece quantity
- **WHEN** a client sends `PATCH /recipe/:id` with `ingredients` that include a `pieceQuantity` on at least one row
- **THEN** the recipe is updated and the persisted ingredients carry the new `pieceQuantity`

#### Scenario: Update with inconsistent pieceQuantity
- **WHEN** a client sends `PATCH /recipe/:id` with an ingredient whose `amount` does not equal `pieceQuantity.amount * pieceQuantity.gramsPerPiece`
- **THEN** the response is `400` and the recipe is unchanged

### Requirement: Recipes UI — list and create
The frontend SHALL provide a Recipes screen, reachable from the bottom navigation, that lists all recipes and exposes a "New recipe" affordance. The recipe form MUST allow entering `name`, `yield`, an ordered list of ingredients (each via the same ingredient picker the log drawer uses), and an ordered list of steps (free-text per step). Saving the form invokes the add-recipe command.

For each ingredient row, the form SHALL render the piece quantity alongside the mass amount when `pieceQuantity` is present (e.g. `1 Zwiebel (≈ 150 g)`), and SHALL allow editing both the piece count and the gram-weight-per-piece. Editing the piece count MUST recompute the mass `amount` using the existing `gramsPerPiece`. Editing `gramsPerPiece` MUST recompute the mass `amount` using the existing piece count. Editing the mass `amount` directly MUST detach the row from piece tracking by clearing `pieceQuantity`, with a visible inline hint warning the user that the piece count will be removed.

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

### Requirement: Recipes UI — edit and delete
From the recipes list, the user SHALL be able to open a recipe and either view it (read mode showing ingredients and cooking steps), edit it (mutates name/yield/ingredients/steps, saves via update-recipe), or delete it (with a confirm step).

In read mode, ingredients with a `pieceQuantity` MUST be rendered in dual form (e.g. `1 Zwiebel (≈ 150 g)`); ingredients without a `pieceQuantity` MUST be rendered as today (`amount unit`).

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

## ADDED Requirements

### Requirement: Yield scaling preserves piece quantities
When a recipe is rendered or rolled up at a different effective yield (e.g. for portion-based logging or future planning views), the system SHALL scale `amount` and `pieceQuantity.amount` by the same factor while keeping `gramsPerPiece` invariant. The invariant `amount === pieceQuantity.amount * pieceQuantity.gramsPerPiece` MUST continue to hold after scaling.

#### Scenario: Doubling portions doubles count and weight
- **WHEN** a recipe with `yield = 2` and an ingredient `{ amount: 150, unit: "g", pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 } }` is rendered for `4` effective portions (factor `2`)
- **THEN** the rendered ingredient has `amount = 300`, `pieceQuantity.amount = 2`, and `pieceQuantity.gramsPerPiece = 150`

#### Scenario: Halving portions halves count and weight
- **WHEN** the same recipe is rendered for `1` effective portion (factor `0.5`)
- **THEN** the rendered ingredient has `amount = 75`, `pieceQuantity.amount = 0.5`, and `pieceQuantity.gramsPerPiece = 150`
