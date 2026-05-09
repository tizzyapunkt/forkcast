# recipes

## Purpose

Define and manage reusable recipes — a yielded list of full ingredients plus ordered cooking steps. Powers the Recipes screen and is the source for batch-logging into the meal log.
## Requirements
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

### Requirement: Add recipe
The system SHALL expose a command to add a new recipe. On success, the system MUST assign a fresh `id`, set `createdAt` and `updatedAt` to the current time, persist the recipe, and return it.

#### Scenario: Add a recipe via HTTP
- **WHEN** a client sends `POST /add-recipe` with a valid body
- **THEN** the response is `200` (or `201`) with the persisted recipe including its assigned `id`, `createdAt`, and `updatedAt`

#### Scenario: Add with invalid body
- **WHEN** a client sends `POST /add-recipe` with a body that fails validation (missing name, empty ingredients, non-positive yield, …)
- **THEN** the response is `400` with an error describing the validation failure, and no recipe is persisted

### Requirement: List recipes
The system SHALL expose a query that returns every persisted recipe, sorted alphabetically by `name` (case-insensitive).

#### Scenario: No recipes
- **WHEN** a client sends `GET /recipes` and no recipes exist
- **THEN** the response is `200` with body `[]`

#### Scenario: Populated list
- **WHEN** recipes "Bolognese", "Apple Pie", and "carrot soup" exist
- **THEN** `GET /recipes` returns them in the order Apple Pie, Bolognese, carrot soup

### Requirement: Get recipe by id
The system SHALL expose a query that returns a single recipe by its `id`.

#### Scenario: Existing recipe
- **WHEN** a client sends `GET /recipes/:id` for an existing recipe
- **THEN** the response is `200` with the full recipe

#### Scenario: Missing recipe
- **WHEN** a client sends `GET /recipes/:id` for an `id` that does not exist
- **THEN** the response is `404`

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

### Requirement: Delete recipe
The system SHALL expose a command to delete a recipe by `id`. On success, the recipe is removed from storage. Deleting a recipe MUST NOT cascade to any `LogEntry` rows that reference it; those entries remain intact, retaining their `recipeId` (the meal-log capability separately handles the now-orphaned reference).

#### Scenario: Delete existing recipe
- **WHEN** a client sends `DELETE /recipe/:id` for an existing recipe
- **THEN** the response is `204` and subsequent `GET /recipes/:id` returns `404`

#### Scenario: Delete missing recipe
- **WHEN** a client sends `DELETE /recipe/:id` for an unknown `id`
- **THEN** the response is `404`

#### Scenario: Logged entries survive recipe deletion
- **WHEN** a recipe has been logged into the meal log and the recipe is then deleted
- **THEN** the `LogEntry` rows produced from that recipe remain in storage with their original ingredient snapshots and their original `recipeId` value

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

### Requirement: Yield scaling preserves piece quantities
When a recipe is rendered or rolled up at a different effective yield (e.g. for portion-based logging or future planning views), the system SHALL scale `amount` and `pieceQuantity.amount` by the same factor while keeping `gramsPerPiece` invariant. The invariant `amount === pieceQuantity.amount * pieceQuantity.gramsPerPiece` MUST continue to hold after scaling.

#### Scenario: Doubling portions doubles count and weight
- **WHEN** a recipe with `yield = 2` and an ingredient `{ amount: 150, unit: "g", pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 } }` is rendered for `4` effective portions (factor `2`)
- **THEN** the rendered ingredient has `amount = 300`, `pieceQuantity.amount = 2`, and `pieceQuantity.gramsPerPiece = 150`

#### Scenario: Halving portions halves count and weight
- **WHEN** the same recipe is rendered for `1` effective portion (factor `0.5`)
- **THEN** the rendered ingredient has `amount = 75`, `pieceQuantity.amount = 0.5`, and `pieceQuantity.gramsPerPiece = 150`

### Requirement: Replace ingredient via picker
The recipe ingredient editor SHALL provide a per-row "replace ingredient" action. The action MUST be reachable from the row's ingredient name, which MUST be rendered as a tappable button-styled element with a small visible affordance glyph (e.g. `↻`) next to the name to communicate that the area is interactive. Tapping the name (or the glyph) MUST open the existing ingredient picker in "replace" mode targeting that specific row.

In replace mode, the picker MUST:
- Render with a dialog title that communicates the replace context (distinct from the additive "add" title).
- Skip the picker's amount-confirmation step entirely. Picking a search result MUST immediately complete the replace and close the picker.

When the replace completes, the editor MUST update the targeted row in place using these per-field rules:

| Field | Rule |
|---|---|
| `name` | Replace with the picked result's `name` |
| `unit` | Replace with the picked result's `unit` |
| `macrosPerUnit` | Replace with the picked result's `macrosPerUnit` |
| `amount` | **Keep** the row's existing value unchanged |
| `pieceQuantity` | Keep verbatim if the picked `unit` is `g` or `ml`; drop entirely otherwise |
| `untracked` | Set to `true` if the picked result has `untracked: true`; otherwise omit/set to absent |

If the row was previously flagged as an AI-estimated `gramsPerPiece` (visible via the estimate badge), the estimate marker for that row MUST be cleared on swap, regardless of whether `pieceQuantity` is preserved or dropped.

The replace MUST NOT modify any other row in the editor.

The replace action MUST be available on every row in the editor — both in the manual recipe form (new + edit) and in the AI-import review screen (which uses the same editor).

#### Scenario: Replace preserves amount
- **GIVEN** a row `{ name: "Olivenöl", unit: "ml", macrosPerUnit: olivenoel, amount: 30 }`
- **WHEN** the user taps the row's name and picks "Sonnenblumenöl" from the picker
- **THEN** the row becomes `{ name: "Sonnenblumenöl", unit: "ml", macrosPerUnit: sonnenblumenoel, amount: 30 }` (amount preserved)

#### Scenario: Replace inherits untracked from new pick
- **GIVEN** a tracked row `{ name: "Olivenöl", untracked: undefined, amount: 30 }`
- **WHEN** the user taps its name and picks the FOODS-untracked entry "Salz" (with `untracked: true`)
- **THEN** the row becomes `{ name: "Salz", untracked: true, amount: 30, ... }`

#### Scenario: Replace clears inherited untracked when new pick is tracked
- **GIVEN** an untracked row `{ name: "Salz", untracked: true, amount: 5 }`
- **WHEN** the user taps its name and picks a tracked FOODS entry (e.g. "Zucker")
- **THEN** the row becomes `{ name: "Zucker", untracked: undefined, amount: 5 }` (the flag is cleared)

#### Scenario: Replace preserves pieceQuantity when new unit is mass
- **GIVEN** a row `{ name: "Zwiebel", unit: "g", amount: 150, pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 } }`
- **WHEN** the user taps the name and picks "Schalotte" (also `unit: "g"`)
- **THEN** the row becomes `{ name: "Schalotte", unit: "g", amount: 150, pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 } }` (piece info preserved)

#### Scenario: Replace drops pieceQuantity when new unit is non-mass
- **GIVEN** a row with `unit: "g"` and `pieceQuantity` set
- **WHEN** the user picks a replacement whose unit is `tbsp`
- **THEN** the row becomes a mass-only row with the new `unit: "tbsp"` and no `pieceQuantity`

#### Scenario: Estimate badge cleared on swap
- **GIVEN** a row whose `gramsPerPiece` was AI-estimated and is currently displaying the estimate badge
- **WHEN** the user swaps the ingredient via the picker (regardless of whether `pieceQuantity` is preserved or dropped)
- **THEN** the estimate badge is no longer rendered for that row

#### Scenario: Picker dialog title reflects replace context
- **WHEN** the user opens the picker via the replace action on a row
- **THEN** the picker's dialog title indicates a replace operation (distinct from the "add" title)

#### Scenario: Replace mode skips the amount step
- **WHEN** the user opens the picker in replace mode and picks a search result
- **THEN** the picker closes immediately and the row updates without surfacing the picker's amount-confirmation step

#### Scenario: Replace does not affect other rows
- **GIVEN** an editor with multiple rows
- **WHEN** the user swaps row index `i`
- **THEN** every row other than `i` is unchanged in name/unit/macros/amount/pieceQuantity/untracked

#### Scenario: Cancelling the picker leaves the row unchanged
- **WHEN** the user opens the picker via the replace action and dismisses (Abbrechen / overlay click) without picking a result
- **THEN** the targeted row is unchanged

#### Scenario: Replace is available in edit mode of an existing recipe
- **GIVEN** an existing recipe opened in edit mode
- **WHEN** the user taps a row's name and picks a different ingredient
- **THEN** the row updates per the rules above and the recipe can be saved via the existing update-recipe flow with the swapped row reflected in the payload

