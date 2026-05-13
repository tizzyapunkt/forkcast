## ADDED Requirements

### Requirement: Recipes UI — serving multiplier on read view
The recipe read (cooking) view SHALL expose a servings multiplier control that lets the user pick the number of effective servings for which ingredient amounts are displayed. The control MUST default to the recipe's stored `yield`. When the chosen value differs from the stored `yield`, the view MUST render every ingredient row at the scaled value, where the scale factor is `chosenServings / recipe.yield`.

The scaling rule MUST match the existing `Yield scaling preserves piece quantities` requirement: each ingredient row's `amount` and (if present) `pieceQuantity.amount` MUST be multiplied by the factor; `pieceQuantity.gramsPerPiece`, `pieceQuantity.unitLabel`, `unit`, `name`, `macrosPerUnit`, and `untracked` MUST be invariant under scaling. Untracked rows MUST scale the same way as tracked rows; only the macro-rollup ignores `macrosPerUnit` for untracked rows, and there is no macro rollup on the read view.

The chosen serving count MUST be ephemeral view state: it MUST NOT mutate the persisted recipe, MUST NOT trigger an API call, and MUST NOT survive navigating away from the read view. The control MUST allow the user to reset the value to the recipe's stored `yield` whenever the value differs.

The minimum selectable value MUST be `1`. There is no enforced maximum.

The cooking-step text MUST NOT be rescaled or modified — only the ingredient rows reflect the multiplier.

#### Scenario: Default matches stored yield
- **WHEN** the user opens a recipe with `yield = 2` in read mode and has not interacted with the multiplier
- **THEN** the multiplier control displays `2` and every ingredient row is rendered at its stored `amount` and `pieceQuantity.amount` (no scaling applied)

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

#### Scenario: Untracked row scales identically and stays muted
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
- **THEN** the step text still reads `"Add 1 chopped onion."` (only ingredient rows reflect the new portion count)

#### Scenario: Multiplier does not mutate the persisted recipe
- **GIVEN** a recipe with `yield = 2`
- **WHEN** the user sets the multiplier to `4`, then leaves the read view and reopens the same recipe
- **THEN** no API call to update the recipe occurred, and on reopen the multiplier defaults to `2` again

#### Scenario: Multiplier does not affect logging or other features
- **GIVEN** a recipe with `yield = 2`
- **WHEN** the user sets the multiplier to `4` on the read view and then logs the recipe from elsewhere in the app
- **THEN** logging behaves exactly as before — the multiplier is purely a view-side concept on the read view
