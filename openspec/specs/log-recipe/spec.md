# log-recipe

## Purpose

From inside the log drawer, pick a recipe, choose portions, and produce one `LogEntry` per recipe ingredient (each tagged with `recipeId`) into the selected date+slot. Logged entries remain individually editable so the user can swap an ingredient on the fly without touching the recipe definition. The daily log shows a visual hint linking each entry back to its source recipe.
## Requirements
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

### Requirement: Recipes tab in the log drawer
The add-food sheet (`LogIngredientDrawer`) SHALL include a "Recipes" tab as the third tab, with the order
Search → Recent → Recipes → Quick. The default selected tab on open remains Search. The Recipes tab SHALL
list the user's recipes, allow filtering them by name client-side, and let the user pick one.

Picking a recipe MUST transition the sheet to a **RecipePortionStep sub-step** — a sheet-level detail
step that **hides the tab bar** and surfaces a header back-arrow, per the `add-food-sheet` capability
("Add-food sheet sub-step navigation and tab-bar hiding"). On that sub-step the user picks the number of
portions, with `1` as the default; submitting invokes `LogRecipe` for the sheet's `date` + `slot`. The
logging behaviour of `LogRecipe` (one entry per tracked ingredient, untracked skipped, scaled by
`portions / yield`) is unchanged.

#### Scenario: Tab ordering
- **WHEN** the add-food sheet opens
- **THEN** the tab bar shows four tabs in the order: Search, Recent, Recipes, Quick

#### Scenario: Default tab unchanged
- **WHEN** the add-food sheet opens
- **THEN** the Search tab is selected by default

#### Scenario: Empty recipes state
- **WHEN** the user selects the Recipes tab and has no recipes
- **THEN** an empty state is shown with a hint pointing to the Recipes screen

#### Scenario: Picking a recipe opens the portions sub-step with the tab bar hidden
- **WHEN** the user selects a recipe from the Recipes tab
- **THEN** the sheet swaps to the RecipePortionStep sub-step, the tab bar is no longer shown, and a header
  back-arrow is present

#### Scenario: Pick and confirm
- **WHEN** the user selects a recipe and submits the portions sub-step
- **THEN** the sheet closes, `LogRecipe` is invoked with the sheet's `date` and `slot`, and the produced
  rows appear in the slot

#### Scenario: Back from the portions sub-step returns to the recipes list and restores the tabs
- **WHEN** the user is on the RecipePortionStep (reached from the Recipes tab) and activates the header
  back-arrow
- **THEN** the sheet returns to the Recipes tab list (not Search) and the tab bar is shown again

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

