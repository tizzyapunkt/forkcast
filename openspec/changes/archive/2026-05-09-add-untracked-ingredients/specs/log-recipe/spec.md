## MODIFIED Requirements

### Requirement: Log a recipe
The system SHALL expose a command `LogRecipe` that, given `{ recipeId, portions, date, slot }`, loads the named recipe and produces one `LogEntry` per **tracked** recipe ingredient, all sharing the same `recipeId`. Recipe ingredients with `untracked: true` MUST be skipped — no `LogEntry` is produced for them. For each produced entry, `ingredient.amount` MUST equal `recipeIngredient.amount * (portions / recipe.yield)`. `ingredient.name`, `ingredient.unit`, and `ingredient.macrosPerUnit` MUST be copied from the recipe ingredient unchanged. Each entry MUST receive a fresh `id` and `loggedAt`.

`portions` MUST be a positive number (floats allowed). `date` and `slot` follow the existing meal-log conventions.

When a recipe contains only untracked ingredients, the command MUST succeed and return an empty array. The command MUST NOT reject such a recipe — marinades, rubs, and seasoning blends are legitimate recipes that simply produce no log entries.

#### Scenario: Log a 4-yield recipe at 2 portions
- **GIVEN** a recipe yields 4 with two ingredients (200g rice, 100g chicken)
- **WHEN** the user logs 2 portions of it for `2026-04-28` lunch
- **THEN** two `LogEntry` rows are created with `amount` 100g and 50g respectively, both for `2026-04-28` / `lunch`, both carrying the recipe's `id` as `recipeId`

#### Scenario: Log non-integer portions
- **GIVEN** a recipe yields 3 with one ingredient (300g)
- **WHEN** the user logs 1 portion
- **THEN** one `LogEntry` is created with `amount = 100` (the persisted float; rounding is a display concern)

#### Scenario: Macros per unit copied verbatim
- **WHEN** a recipe is logged at any portions
- **THEN** every produced `LogEntry`'s `macrosPerUnit` is identical to the source recipe ingredient's `macrosPerUnit` (no scaling applied to per-unit macros)

#### Scenario: Missing recipe rejected
- **WHEN** `LogRecipe` is invoked with a `recipeId` that does not exist
- **THEN** the command fails with a not-found error and no `LogEntry` rows are persisted

#### Scenario: Non-positive portions rejected
- **WHEN** `LogRecipe` is invoked with `portions <= 0`
- **THEN** the command fails with a validation error and no `LogEntry` rows are persisted

#### Scenario: Atomic write
- **WHEN** `LogRecipe` is invoked and a partial write would occur (e.g. one row succeeds and one fails)
- **THEN** either every produced `LogEntry` is persisted or none are — no partial recipe logs

#### Scenario: Untracked ingredients skipped
- **GIVEN** a recipe yields 2 with three ingredients: 200 g rice (tracked), 100 g chicken (tracked), 5 g salt (`untracked: true`)
- **WHEN** the user logs 1 portion of it
- **THEN** exactly two `LogEntry` rows are created (for rice and chicken, scaled by `1/2`); no `LogEntry` is created for salt

#### Scenario: All-untracked recipe produces empty result
- **GIVEN** a recipe whose every ingredient has `untracked: true`
- **WHEN** the user logs any positive portion of it
- **THEN** the command succeeds and returns an empty array; no `LogEntry` rows are persisted

### Requirement: HTTP endpoint to log a recipe
The system SHALL expose `POST /log-recipe` accepting body `{ recipeId, portions, date, slot }` and returning the created `LogEntry[]` on success. When the source recipe consists entirely of untracked ingredients, the response body MUST be `[]` with status `200` (or `201`).

#### Scenario: Successful log
- **WHEN** a client sends `POST /log-recipe` with valid body
- **THEN** the response is `200` (or `201`) with a JSON array of the produced `LogEntry` rows

#### Scenario: Invalid body
- **WHEN** a client sends `POST /log-recipe` missing a required field or with `portions <= 0`
- **THEN** the response is `400` and no entries are persisted

#### Scenario: Unknown recipeId
- **WHEN** a client sends `POST /log-recipe` with a `recipeId` that does not exist
- **THEN** the response is `404` and no entries are persisted

#### Scenario: All-untracked recipe returns empty array with success
- **WHEN** a client sends `POST /log-recipe` for a recipe whose every ingredient is untracked
- **THEN** the response is `200` (or `201`) with body `[]`

## ADDED Requirements

### Requirement: Log drawer disables logging of untracked search results
The `LogIngredientDrawer`'s Search tab SHALL continue to display FOODS results that have `untracked: true` (so the user can see they exist), but MUST disable the row's "log" / "select" affordance and render the row in a muted style with an inline hint indicating the row cannot be logged because it is untracked. The hint copy SHOULD make clear that the user can still pick the ingredient inside a recipe.

This requirement only applies to the log drawer flow. The recipe-form ingredient picker MUST continue to allow picking untracked search results normally.

#### Scenario: Untracked FOODS result rendered un-loggable
- **WHEN** the user opens the log drawer's Search tab and a query returns a FOODS result with `untracked: true` (e.g. "Salz")
- **THEN** the row is rendered in a muted style with the log/select affordance disabled and an inline hint explaining the row is untracked

#### Scenario: Tracked results unchanged
- **WHEN** the same query returns tracked FOODS or OFF results alongside untracked ones
- **THEN** tracked results render and behave as today (selectable, logable)

#### Scenario: Recipe-form picker still allows untracked selection
- **WHEN** the user opens the recipe form's ingredient picker and the same query returns an untracked FOODS result
- **THEN** the result is selectable and adding it produces a new ingredient row with `untracked: true` (per the recipes capability)
