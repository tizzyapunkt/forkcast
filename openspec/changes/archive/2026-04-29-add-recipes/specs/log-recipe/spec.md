## ADDED Requirements

### Requirement: LogEntry gains optional recipeId
The system SHALL extend the `LogEntry` shape with an optional `recipeId?: string`. Entries logged from a recipe MUST carry the source recipe's `id`; entries logged ad-hoc (via Search, Recent, or Quick) MUST NOT carry one. The field MUST be optional in both wire and persisted formats: existing entries (without the field) MUST load and roundtrip unchanged.

#### Scenario: Ad-hoc entries have no recipeId
- **WHEN** the user logs a single ingredient through Search, Recent, or Quick
- **THEN** the resulting `LogEntry` MUST NOT include a `recipeId` field

#### Scenario: Recipe-sourced entries carry recipeId
- **WHEN** a recipe is logged
- **THEN** every produced `LogEntry` MUST include `recipeId` set to the source recipe's `id`

#### Scenario: Pre-existing entries load
- **WHEN** the system reads `LogEntry` records persisted before this change (no `recipeId` field)
- **THEN** they load successfully with `recipeId === undefined`

### Requirement: Log a recipe
The system SHALL expose a command `LogRecipe` that, given `{ recipeId, portions, date, slot }`, loads the named recipe and produces one `LogEntry` per recipe ingredient, all sharing the same `recipeId`. For each produced entry, `ingredient.amount` MUST equal `recipeIngredient.amount * (portions / recipe.yield)`. `ingredient.name`, `ingredient.unit`, and `ingredient.macrosPerUnit` MUST be copied from the recipe ingredient unchanged. Each entry MUST receive a fresh `id` and `loggedAt`.

`portions` MUST be a positive number (floats allowed). `date` and `slot` follow the existing meal-log conventions.

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

### Requirement: HTTP endpoint to log a recipe
The system SHALL expose `POST /log-recipe` accepting body `{ recipeId, portions, date, slot }` and returning the created `LogEntry[]` on success.

#### Scenario: Successful log
- **WHEN** a client sends `POST /log-recipe` with valid body
- **THEN** the response is `200` (or `201`) with a JSON array of the produced `LogEntry` rows

#### Scenario: Invalid body
- **WHEN** a client sends `POST /log-recipe` missing a required field or with `portions <= 0`
- **THEN** the response is `400` and no entries are persisted

#### Scenario: Unknown recipeId
- **WHEN** a client sends `POST /log-recipe` with a `recipeId` that does not exist
- **THEN** the response is `404` and no entries are persisted

### Requirement: Recipes tab in the log drawer
The `LogIngredientDrawer` SHALL include a "Recipes" tab as the third tab, with the order Search → Recent → Recipes → Quick. The default selected tab on drawer open remains Search. The Recipes tab SHALL list the user's recipes, allow filtering them by name client-side, and let the user pick one. Picking a recipe MUST transition the drawer to a portions-confirm step (analogous to the existing full-entry confirm) where the user picks the number of portions, with `1` as the default. Submitting the confirm step invokes `LogRecipe` for the drawer's `date` + `slot`.

#### Scenario: Tab ordering
- **WHEN** the log drawer opens
- **THEN** the tab bar shows four tabs in the order: Search, Recent, Recipes, Quick

#### Scenario: Default tab unchanged
- **WHEN** the log drawer opens
- **THEN** the Search tab is selected by default

#### Scenario: Empty recipes state
- **WHEN** the user selects the Recipes tab and has no recipes
- **THEN** an empty state is shown with a hint pointing to the Recipes screen

#### Scenario: Pick and confirm
- **WHEN** the user selects a recipe from the Recipes tab and submits the portions confirm
- **THEN** the drawer closes, `LogRecipe` is invoked with the drawer's `date` and `slot`, and the produced rows appear in the slot

#### Scenario: Back from portions-confirm returns to recipes list
- **WHEN** the user is on the portions-confirm step (reached from the Recipes tab) and presses Back
- **THEN** the drawer returns to the Recipes tab list, not Search

### Requirement: Daily log shows a visual hint for recipe-sourced entries
The frontend SHALL render a visual hint on every `LogEntry` row whose `recipeId` resolves to an existing recipe, displaying the source recipe's current name. If `recipeId` is absent, OR is set but does not resolve to any existing recipe (because the recipe was deleted), no hint MUST be rendered. The hint is purely informational: editing or removing the entry MUST work identically whether or not it carries a `recipeId`.

#### Scenario: Hint visible when recipe exists
- **WHEN** a `LogEntry` carries a `recipeId` that matches an existing recipe
- **THEN** its row in the daily log shows a hint labelled with the recipe's current name

#### Scenario: Renamed recipe reflects live
- **WHEN** the underlying recipe is renamed
- **THEN** the next render of the daily log displays the new name in the hint for entries that reference it

#### Scenario: Deleted recipe — no hint, entry survives
- **WHEN** the underlying recipe is deleted
- **THEN** the entry's row no longer shows the recipe hint, but the entry itself is unchanged and still editable/removable

#### Scenario: No hint for ad-hoc entries
- **WHEN** an entry has no `recipeId`
- **THEN** no recipe hint is shown

### Requirement: Editing recipe-sourced entries leaves the link intact
The user SHALL be able to edit (e.g. change `amount`) or remove a `LogEntry` regardless of whether it has a `recipeId`. Editing MUST NOT clear `recipeId`; the entry continues to display the recipe hint. Removing the entry simply deletes that one row and leaves all other recipe-sourced rows unaffected. This supports the "swap an ingredient on the fly" use case: if an ingredient was unavailable, the user can edit just that row without touching the recipe definition.

#### Scenario: Edit amount, link preserved
- **WHEN** the user edits the `amount` of a recipe-sourced `LogEntry`
- **THEN** the entry persists with the new amount AND its original `recipeId`, and the recipe hint still appears

#### Scenario: Remove one entry of a recipe batch
- **WHEN** the user removes one entry produced by a recipe log
- **THEN** only that entry is deleted; the remaining entries from the same recipe-log batch are unaffected
