# recipes

## Purpose

Define and manage reusable recipes — a yielded list of full ingredients plus ordered cooking steps. Powers the Recipes screen and is the source for batch-logging into the meal log.
## Requirements
### Requirement: Recipe entity shape
The system SHALL model a `Recipe` as an aggregate consisting of `id` (string), `name` (non-empty string), `yield` (positive integer representing the number of portions the recipe produces), `ingredients` (ordered list of full ingredients — `{ name, unit, macrosPerUnit, amount, pieceQuantity?, untracked?, displayQuantity? }`), `steps` (ordered list of non-empty strings, each describing one cooking step), `createdAt` (ISO datetime), and `updatedAt` (ISO datetime).

A recipe MUST have at least one ingredient. Steps MAY be empty (a recipe with no steps is a pure ingredient batch).

`pieceQuantity` is optional. When present it has the shape `{ amount: number, unitLabel: string, gramsPerPiece: number }` where `amount` is the count as written (positive number, may be fractional), `unitLabel` is the free-text noun the recipe used for the piece (e.g. `"onion"`, `"medium zucchini"`, `"clove"`), and `gramsPerPiece` is the canonical mass of one piece in the ingredient's `unit` (positive number). When `pieceQuantity` is present the ingredient's `unit` MUST be `g` or `ml`, and the invariant `amount === pieceQuantity.amount * pieceQuantity.gramsPerPiece` MUST hold (within a small floating-point tolerance) at the time of validation.

`untracked` is an optional boolean flag, defaulting to `false` (or absent — semantically equivalent). When `true`, the ingredient is part of the recipe (and its identity, instructions, and any future grocery list) but MUST NOT contribute to nutrition rollups anywhere in the system. Untracked ingredients MUST still carry a valid `unit` from the enum and a finite `amount >= 0` (the `amount > 0` rule that applies to tracked rows is relaxed to `amount >= 0` for untracked rows so that AI-imported seasonings with no extracted quantity can be persisted as `amount = 0` and surfaced for manual completion). `macrosPerUnit` remains part of the persisted shape — its values are simply ignored at consume time.

`displayQuantity` is optional and MAY be present only when `untracked === true`. When present it has the shape `{ amount: number, unitLabel: string }` where `amount` is a finite non-negative number (fractional allowed) and `unitLabel` is a free-text, non-empty trimmed string of at most 24 characters. The validator MUST reject `displayQuantity` on a tracked row. `displayQuantity` is the source of truth for the rendered quantity on untracked rows wherever those rows are displayed (recipe form, recipes list, recipe read view); the canonical `amount` and `unit` remain stored on the row for shape stability.

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
- **WHEN** the recipe store contains a recipe whose ingredients have no `pieceQuantity`, no `untracked`, and no `displayQuantity` field
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

In read mode, when an untracked ingredient carries a `displayQuantity` (`{ amount, unitLabel }`), the row MUST render `{displayQuantity.amount} {displayQuantity.unitLabel}` in place of `{amount} {unit}`. Untracked rows without a `displayQuantity` MUST render the canonical `{amount} {unit}` as today (still muted).

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

#### Scenario: Cooking view renders displayQuantity on untracked rows
- **GIVEN** an untracked row with `displayQuantity = { amount: 1, unitLabel: "TL" }` and canonical `amount: 0, unit: "g"`
- **WHEN** the user opens the recipe in read mode
- **THEN** the row renders `1 TL` (not `0 g`), still muted, with the untracked badge

#### Scenario: Cooking view renders canonical amount on untracked row without displayQuantity
- **GIVEN** an untracked row with no `displayQuantity` and canonical `amount: 5, unit: "g"`
- **WHEN** the user opens the recipe in read mode
- **THEN** the row renders `5 g` muted with the untracked badge (today's behavior)

### Requirement: Yield scaling preserves piece quantities
When a recipe is rendered or rolled up at a different effective yield (e.g. for portion-based logging or future planning views), the system SHALL scale `amount` and `pieceQuantity.amount` by the same factor while keeping `gramsPerPiece` invariant. The invariant `amount === pieceQuantity.amount * pieceQuantity.gramsPerPiece` MUST continue to hold after scaling.

When the row carries a `displayQuantity`, scaling MUST also multiply `displayQuantity.amount` by the factor; `displayQuantity.unitLabel` MUST remain invariant. The macro rollup MUST continue to ignore untracked rows under scaling.

#### Scenario: Doubling portions doubles count and weight
- **WHEN** a recipe with `yield = 2` and an ingredient `{ amount: 150, unit: "g", pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 } }` is rendered for `4` effective portions (factor `2`)
- **THEN** the rendered ingredient has `amount = 300`, `pieceQuantity.amount = 2`, and `pieceQuantity.gramsPerPiece = 150`

#### Scenario: Halving portions halves count and weight
- **WHEN** the same recipe is rendered for `1` effective portion (factor `0.5`)
- **THEN** the rendered ingredient has `amount = 75`, `pieceQuantity.amount = 0.5`, and `pieceQuantity.gramsPerPiece = 150`

#### Scenario: Doubling portions doubles displayQuantity amount
- **GIVEN** an untracked row with `displayQuantity = { amount: 1, unitLabel: "TL" }`
- **WHEN** the row is rendered at a scale factor of `2`
- **THEN** the rendered row has `displayQuantity = { amount: 2, unitLabel: "TL" }` (unitLabel invariant)

#### Scenario: Halving portions halves displayQuantity amount
- **GIVEN** an untracked row with `displayQuantity = { amount: 1, unitLabel: "TL" }`
- **WHEN** the row is rendered at a scale factor of `0.5`
- **THEN** the rendered row has `displayQuantity = { amount: 0.5, unitLabel: "TL" }`

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

### Requirement: Recipes UI — serving multiplier on read view
The recipe read (cooking) view SHALL expose a servings multiplier control that lets the user pick the number of effective servings for which ingredient amounts are displayed. The control MUST default to the recipe's stored `yield`. When the chosen value differs from the stored `yield`, the view MUST render every ingredient row at the scaled value, where the scale factor is `chosenServings / recipe.yield`.

The scaling rule MUST match the existing `Yield scaling preserves piece quantities` requirement: each ingredient row's `amount`, (if present) `pieceQuantity.amount`, and (if present) `displayQuantity.amount` MUST be multiplied by the factor; `pieceQuantity.gramsPerPiece`, `pieceQuantity.unitLabel`, `displayQuantity.unitLabel`, `unit`, `name`, `macrosPerUnit`, and `untracked` MUST be invariant under scaling. Untracked rows MUST scale the same way as tracked rows; only the macro-rollup ignores `macrosPerUnit` for untracked rows.

The recipe's nutrition totals strip (see "Recipe read view displays nutrition totals reactive to multiplier") MUST react to the multiplier: the per-serving line is invariant under scaling, the "total at current multiplier" line is `perServing * chosenServings`.

The chosen serving count MUST be ephemeral view state: it MUST NOT mutate the persisted recipe, MUST NOT trigger an API call, and MUST NOT survive navigating away from the read view. The control MUST allow the user to reset the value to the recipe's stored `yield` whenever the value differs.

The minimum selectable value MUST be `1`. There is no enforced maximum.

The cooking-step text MUST NOT be rescaled or modified — only the ingredient rows and the totals strip reflect the multiplier.

#### Scenario: Default matches stored yield
- **WHEN** the user opens a recipe with `yield = 2` in read mode and has not interacted with the multiplier
- **THEN** the multiplier control displays `2` and every ingredient row is rendered at its stored `amount`, `pieceQuantity.amount`, and `displayQuantity.amount` (no scaling applied)

#### Scenario: Doubling scales mass and piece count
- **GIVEN** a recipe with `yield = 2` and an ingredient `{ amount: 150, unit: "g", pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 } }`
- **WHEN** the user sets the multiplier to `4`
- **THEN** the row renders `2 Zwiebel (≈ 300 g)` (i.e. `pieceQuantity.amount = 2`, `amount = 300`), and `gramsPerPiece` remains `150`

#### Scenario: Halving scales mass and piece count
- **GIVEN** the same recipe with `yield = 2`
- **WHEN** the user sets the multiplier to `1`
- **THEN** the row renders `0.5 Zwiebel (≈ 75 g)` (i.e. `pieceQuantity.amount = 0.5`, `amount = 75`), and `gramsPerPiece` remains `150`

#### Scenario: Mass-only row scales without piece info
- **GIVEN** a recipe with `yield = 2` and a row `{ amount: 100, unit: "g" }` (no `pieceQuantity`)
- **WHEN** the user sets the multiplier to `5`
- **THEN** the row renders `250 g`

#### Scenario: Untracked row with displayQuantity scales the displayed amount
- **GIVEN** a recipe with `yield = 2` and a row `{ amount: 0, unit: "g", untracked: true, displayQuantity: { amount: 1, unitLabel: "TL" } }`
- **WHEN** the user sets the multiplier to `4`
- **THEN** the row renders `2 TL` (muted, with untracked badge), and `displayQuantity.unitLabel` remains "TL"

#### Scenario: Untracked row without displayQuantity scales identically and stays muted
- **GIVEN** a recipe with `yield = 2` and a row `{ amount: 5, unit: "g", untracked: true }`
- **WHEN** the user sets the multiplier to `4`
- **THEN** the row renders `10 g`, retains its muted styling, and retains the untracked badge

#### Scenario: Multiplier minimum is 1
- **WHEN** the user attempts to decrement the multiplier below `1`
- **THEN** the value stays at `1` (the decrement is a no-op at the floor)

#### Scenario: Reset returns to stored yield
- **GIVEN** a recipe with `yield = 2` and the user has set the multiplier to `6`
- **WHEN** the user invokes the reset control
- **THEN** the multiplier returns to `2` and every ingredient row renders at its stored `amount`

#### Scenario: Steps are not rescaled
- **GIVEN** a recipe whose first step text is `"Add 1 chopped onion."`
- **WHEN** the user sets the multiplier to `4`
- **THEN** the step text still reads `"Add 1 chopped onion."` (only ingredient rows and the totals strip reflect the new portion count)

#### Scenario: Multiplier does not mutate the persisted recipe
- **GIVEN** a recipe with `yield = 2`
- **WHEN** the user sets the multiplier to `4`, then leaves the read view and reopens the same recipe
- **THEN** no API call to update the recipe occurred, and on reopen the multiplier defaults to `2` again

#### Scenario: Multiplier does not affect logging or other features
- **GIVEN** a recipe with `yield = 2`
- **WHEN** the user sets the multiplier to `4` on the read view and then logs the recipe from elsewhere in the app
- **THEN** logging behaves exactly as before — the multiplier is purely a view-side concept on the read view

### Requirement: Compute recipe macro totals
The frontend SHALL expose a pure helper `computeRecipeTotals(ingredients, yieldValue)` that returns `{ total, perServing }` where each side is a `MacrosPer100` (`{ calories, protein, carbs, fat }`).

The total MUST be computed by, for each ingredient row where `untracked !== true`, adding `macrosPerUnit.X * amount` to the corresponding `total.X` across all four macros. Untracked rows MUST contribute zero to every macro regardless of their `macrosPerUnit` or `amount` values.

The per-serving value MUST be `total / max(yieldValue, 1)` for each macro (defensive guard: a non-positive yield is treated as `1`). An empty ingredient list MUST yield zeros for both `total` and `perServing`.

This helper MUST be the single source of truth used by the recipes list row, the recipe read view, and the recipe create/edit form for displaying totals.

#### Scenario: Tracked ingredient contributes to totals
- **GIVEN** a recipe with `yield = 2` and one ingredient `{ amount: 100, macrosPerUnit: { calories: 2, protein: 0.2, carbs: 0, fat: 0.1 } }`
- **WHEN** the helper is called
- **THEN** `total = { calories: 200, protein: 20, carbs: 0, fat: 10 }` and `perServing = { calories: 100, protein: 10, carbs: 0, fat: 5 }`

#### Scenario: Untracked ingredient excluded from totals
- **GIVEN** a recipe with two ingredients: one tracked with `amount: 100, macrosPerUnit: { calories: 2, protein: 0, carbs: 0, fat: 0 }` and one untracked with `amount: 5, macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 }, untracked: true`
- **WHEN** the helper is called with `yieldValue = 1`
- **THEN** `total.calories = 200` (the untracked row's `5 * 9 = 45 kcal` is not included)

#### Scenario: Empty ingredient list yields zeros
- **WHEN** the helper is called with `ingredients = []` and any `yieldValue`
- **THEN** `total` and `perServing` are both `{ calories: 0, protein: 0, carbs: 0, fat: 0 }`

#### Scenario: Non-positive yield treated as one
- **WHEN** the helper is called with `yieldValue = 0` (or negative)
- **THEN** `perServing` equals `total` (the helper defensively divides by `1`)

### Requirement: Recipe form displays live nutrition totals
The recipe create/edit form SHALL render a totals strip that displays the recipe's per-serving macros (calories, protein, carbs, fat) computed from the current in-memory `ingredients` and `yield` state via `computeRecipeTotals`. The strip MUST update on every state change — adding, replacing, removing, editing an ingredient, toggling `untracked`, or changing `yield`. The strip MUST also display the total for the full recipe (sum across all servings) in a less prominent form (secondary line or expandable).

The strip MUST be visible alongside the ingredient editor (above the action buttons or directly below the editor) so the user sees totals without scrolling away from edits.

The strip MUST NOT trigger any network call; computation is fully client-side.

#### Scenario: Totals update when an ingredient is added
- **GIVEN** the recipe form is open with an empty ingredient list and the totals strip shows `0 kcal · 0 P / 0 C / 0 F`
- **WHEN** the user adds an ingredient `{ amount: 100, macrosPerUnit: { calories: 2, protein: 0.2, carbs: 0, fat: 0 } }` to a recipe with `yield = 1`
- **THEN** the totals strip updates to `200 kcal · 20 P / 0 C / 0 F` per serving

#### Scenario: Totals update when an ingredient is toggled untracked
- **GIVEN** the form contains one tracked ingredient contributing 200 kcal per serving
- **WHEN** the user toggles that row to untracked
- **THEN** the totals strip updates to `0 kcal · 0 P / 0 C / 0 F` per serving (untracked rows are excluded)

#### Scenario: Totals update when an ingredient amount is edited
- **GIVEN** the form contains one tracked ingredient with `amount: 100` contributing 200 kcal per serving (yield 1)
- **WHEN** the user changes the amount to `150`
- **THEN** the totals strip updates to `300 kcal · 30 P / 0 C / 0 F` per serving

#### Scenario: Totals update when yield changes
- **GIVEN** the form contains a recipe with `total = 400 kcal` and `yield = 2`, showing `200 kcal` per serving
- **WHEN** the user changes the yield to `4`
- **THEN** the totals strip updates to `100 kcal` per serving (total unchanged)

#### Scenario: Strip computation does not call the API
- **WHEN** the user interacts with any field in the recipe form
- **THEN** no request is sent to the backend solely to compute totals

### Requirement: Untracked ingredient displayQuantity
Each `RecipeIngredient` MAY carry an optional `displayQuantity` field with the shape `{ amount: number; unitLabel: string }`. `displayQuantity` is only valid when the row's `untracked === true`. The validator MUST reject a row that carries `displayQuantity` with `untracked !== true`.

When present:
- `amount` MUST be a finite number `>= 0`. Fractional values are permitted.
- `unitLabel` MUST be a non-empty string (after trim) of at most 24 characters. Free-form German/English seasoning units (`TL`, `EL`, `Prise`, `Schuss`, `tsp`, `clove`, …) are all valid.

`displayQuantity` is the source of truth for the rendered quantity on untracked rows wherever the row is displayed (form, list, read view). When `displayQuantity` is absent, the canonical `amount unit` is displayed as today.

The canonical `unit` field MUST still be present and remain one of the existing `MeasurementUnit` enum values, even on rows that carry a `displayQuantity` (shape stability for downstream consumers).

#### Scenario: Untracked row with displayQuantity persists
- **WHEN** a recipe is created with an ingredient `{ name: "Salz", unit: "g", amount: 0, untracked: true, macrosPerUnit, displayQuantity: { amount: 1, unitLabel: "TL" } }`
- **THEN** the recipe is accepted and persisted with `displayQuantity` intact on that row

#### Scenario: Tracked row with displayQuantity rejected
- **WHEN** a recipe is created with an ingredient that has `untracked` absent (or `false`) and a `displayQuantity` set
- **THEN** the system rejects the request with a validation error indicating displayQuantity is only allowed on untracked rows

#### Scenario: Empty unitLabel rejected
- **WHEN** a recipe is created with an untracked ingredient whose `displayQuantity.unitLabel` is empty or whitespace-only
- **THEN** the system rejects the request with a validation error

#### Scenario: Overlong unitLabel rejected
- **WHEN** a recipe is created with an untracked ingredient whose `displayQuantity.unitLabel` exceeds 24 characters after trim
- **THEN** the system rejects the request with a validation error

#### Scenario: Backwards-compatible read of legacy untracked row
- **WHEN** the recipe store contains an untracked ingredient with no `displayQuantity` field
- **THEN** the recipe loads successfully and is returned with `displayQuantity` absent on that row

### Requirement: Recipe form displayQuantity editor
The recipe ingredient editor SHALL render a `displayQuantity` editor on every untracked row. The editor has two states:

**State A — `displayQuantity` absent**: the row renders the canonical `amount unit` (muted, as today) plus an inline `+ Menge` (display: "+ Menge ergänzen") affordance. Activating the affordance reveals an inline form with a numeric input (amount, decimals allowed) and a free-text input (unit label, max 24 chars), plus a confirm (✓) and cancel (✕) control. Confirming with valid values writes `displayQuantity` onto the row in form state. Cancelling leaves the row unchanged.

**State B — `displayQuantity` present**: the row renders `{displayQuantity.amount} {displayQuantity.unitLabel}` in place of the canonical `amount unit` (still muted styling for untracked). A small ✎ affordance opens the same inline form pre-filled with the current values. The form additionally exposes a "Menge entfernen" action that clears `displayQuantity` (restores State A).

The editor MUST NOT render the displayQuantity affordance on tracked rows.

Toggling a row from tracked → untracked MUST leave any future displayQuantity entry possible; toggling untracked → tracked MUST clear any existing `displayQuantity` from form state (so it cannot accidentally be persisted on a tracked row).

#### Scenario: Untracked row without displayQuantity shows add affordance
- **GIVEN** the editor contains an untracked row with no `displayQuantity`
- **THEN** the row renders the canonical `amount unit` and an inline `+ Menge ergänzen` button

#### Scenario: User adds displayQuantity inline
- **GIVEN** an untracked row without `displayQuantity`
- **WHEN** the user taps `+ Menge ergänzen`, enters `amount = 1` and `unitLabel = "TL"`, and confirms
- **THEN** the row's `displayQuantity` becomes `{ amount: 1, unitLabel: "TL" }` and the row now renders `1 TL` in place of the canonical amount/unit

#### Scenario: User edits an existing displayQuantity
- **GIVEN** an untracked row with `displayQuantity = { amount: 1, unitLabel: "TL" }`
- **WHEN** the user taps the row's ✎ affordance, changes the amount to `2`, and confirms
- **THEN** the row renders `2 TL` and the form state reflects the updated `displayQuantity`

#### Scenario: User clears a displayQuantity
- **GIVEN** an untracked row with `displayQuantity = { amount: 1, unitLabel: "Prise" }`
- **WHEN** the user opens the editor and chooses "Menge entfernen"
- **THEN** `displayQuantity` is removed from the row and the row reverts to rendering the canonical `amount unit`

#### Scenario: Toggling untracked → tracked clears displayQuantity
- **GIVEN** an untracked row with `displayQuantity = { amount: 1, unitLabel: "TL" }`
- **WHEN** the user toggles the row to tracked
- **THEN** `displayQuantity` is removed from form state (so the row cannot be saved with both `untracked: false` and a `displayQuantity`)

#### Scenario: Tracked row does not show displayQuantity affordance
- **GIVEN** the editor contains a tracked row
- **THEN** no `+ Menge ergänzen` button is rendered on that row

### Requirement: Recipes list row displays per-serving macros
The Recipes list (the screen reachable from the bottom navigation) SHALL render, for each recipe row, a one-line per-serving macro summary derived from `computeRecipeTotals(recipe.ingredients, recipe.yield).perServing`. The summary MUST display calories and the three macro grams in the format `{kcal} kcal · {protein} P / {carbs} C / {fat} F` (German: `kcal`, `P`, `C`, `F` per the existing i18n shorthand). Untracked rows MUST NOT contribute to this rollup.

The macro line MUST appear in addition to (not in place of) the existing meta line (`X Zutaten · Y Portionen`). The macro line MUST be readable at mobile width; numbers MUST use tabular alignment so long names do not collapse the column.

#### Scenario: Recipe with tracked ingredients shows non-zero macros
- **GIVEN** a recipe with `yield = 2` whose tracked ingredients sum to `400 kcal · 40 P / 20 C / 20 F` total
- **WHEN** the user opens the Recipes list
- **THEN** that recipe's row renders the macro line `200 kcal · 20 P / 10 C / 10 F` per serving

#### Scenario: Recipe with only untracked ingredients shows zero macros
- **GIVEN** a recipe whose every ingredient is untracked
- **WHEN** the user opens the Recipes list
- **THEN** that recipe's row renders the macro line `0 kcal · 0 P / 0 C / 0 F`

#### Scenario: Existing meta line still rendered
- **WHEN** the Recipes list is shown
- **THEN** every row still renders the existing `X Zutaten · Y Portionen` meta line in addition to the new macro line

### Requirement: Recipe read view displays nutrition totals reactive to multiplier
The recipe read (cooking) view SHALL render a nutrition totals strip near the top of the view (above or below the recipe name/yield block, above the ingredients section). The strip MUST show:

- A primary per-serving line: `Pro Portion: {kcal} kcal · {protein} P / {carbs} C / {fat} F`.
- A secondary "total at current multiplier" line: `Bei {chosenServings} Portionen: {kcal} kcal · {protein} P / {carbs} C / {fat} F` where `chosenServings` is the value of the existing servings multiplier on this view.

The per-serving values MUST equal `computeRecipeTotals(recipe.ingredients, recipe.yield).perServing` — invariant under the multiplier. The "total at current multiplier" values MUST equal `perServing * chosenServings`.

The strip MUST update reactively when the user changes the servings multiplier control; no API call MAY be triggered as a result of multiplier changes (purely client-side).

Untracked ingredients MUST NOT contribute to either line regardless of multiplier value.

#### Scenario: Totals match per-serving values at default multiplier
- **GIVEN** a recipe with `yield = 2` whose tracked ingredients sum to `400 kcal` total
- **WHEN** the user opens the recipe in read mode without touching the multiplier
- **THEN** the strip shows `Pro Portion: 200 kcal · …` and `Bei 2 Portionen: 400 kcal · …`

#### Scenario: Totals scale when multiplier changes
- **GIVEN** the same recipe with default multiplier of 2
- **WHEN** the user sets the multiplier to `4`
- **THEN** the strip shows `Pro Portion: 200 kcal · …` (unchanged) and `Bei 4 Portionen: 800 kcal · …`

#### Scenario: Multiplier does not trigger API call
- **WHEN** the user changes the multiplier on the read view
- **THEN** no request is sent to the backend solely to recompute totals

#### Scenario: Untracked rows ignored regardless of multiplier
- **GIVEN** a recipe with one tracked row contributing 200 kcal per serving and one untracked row that would notionally contribute 100 kcal per serving if counted
- **WHEN** the user sets the multiplier to `3`
- **THEN** the strip shows `Pro Portion: 200 kcal` and `Bei 3 Portionen: 600 kcal` (the untracked row is excluded regardless of multiplier)
