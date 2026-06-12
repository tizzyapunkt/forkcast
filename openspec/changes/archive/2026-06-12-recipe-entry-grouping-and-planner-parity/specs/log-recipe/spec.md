# log-recipe — delta

## ADDED Requirements

### Requirement: LogEntry carries recipe batch metadata

The system SHALL extend the `LogEntry` shape with two further optional fields alongside the
existing `recipeId`: `recipeBatchId?: string` — an identifier shared by all entries produced by one
`LogRecipe` invocation and unique per invocation — and `recipePortions?: number` — the portion
count the user chose at log time. Entries logged ad-hoc (Search, Recent, Quick) MUST NOT carry
either field. Both fields MUST be optional in wire and persisted formats: entries persisted before
this change (with or without `recipeId`) MUST load and roundtrip unchanged.

`recipePortions` records the logged portion count; later edits to individual entry amounts MUST NOT
alter it (it documents what was logged, not a live rollup).

#### Scenario: Batch fields persisted and roundtripped

- **WHEN** a recipe is logged at 2 portions
- **THEN** every produced `LogEntry` persists with the same `recipeBatchId` and `recipePortions = 2`, and reads back identically

#### Scenario: Ad-hoc entries carry no batch metadata

- **WHEN** the user logs a single ingredient through Search, Recent, or Quick
- **THEN** the resulting `LogEntry` has neither `recipeBatchId` nor `recipePortions`

#### Scenario: Pre-existing entries load

- **WHEN** the system reads `LogEntry` records persisted before this change
- **THEN** they load successfully with `recipeBatchId === undefined` and `recipePortions === undefined`

#### Scenario: Editing an amount leaves recipePortions untouched

- **GIVEN** a batch logged at 2 portions
- **WHEN** the user edits one entry's `amount`
- **THEN** that entry's `recipePortions` still reads `2`

### Requirement: Remove a recipe-log batch atomically

The system SHALL expose a command `RemoveRecipeLog` that, given a `recipeBatchId` (with the
date/slot context the API needs to scope the lookup), deletes **all** `LogEntry` rows carrying that
`recipeBatchId` in a single atomic write — either every row of the batch is removed or none
(mirroring `LogRecipe`'s atomic insert). A batch id that matches no entries MUST fail with a
not-found error. The system SHALL expose a matching HTTP endpoint following the existing
domain-language API conventions.

In the UI (daily log and planner), the group banner of a batch SHALL expose a single remove
affordance that invokes this command; removing the batch MUST NOT affect entries outside the batch.
Removing individual entries inside the batch continues to work per "Editing recipe-sourced entries
leaves the link intact".

#### Scenario: Batch removed atomically

- **GIVEN** a slot containing a 3-entry recipe batch and one ad-hoc entry
- **WHEN** the user activates the group's remove affordance
- **THEN** all 3 batch entries are deleted in one atomic operation and the ad-hoc entry is unaffected

#### Scenario: Unknown batch id rejected

- **WHEN** `RemoveRecipeLog` is invoked with a `recipeBatchId` that matches no entries
- **THEN** the command fails with a not-found error and nothing is deleted

#### Scenario: Slot totals update after batch removal

- **WHEN** a batch is removed from a slot
- **THEN** the slot's displayed kcal/macro totals reflect the remaining entries on the next render

## MODIFIED Requirements

### Requirement: Log a recipe

The system SHALL expose a command `LogRecipe` that, given `{ recipeId, portions, date, slot }`, loads the named recipe and produces one `LogEntry` per **tracked** recipe ingredient, all sharing the same `recipeId`. Recipe ingredients with `untracked: true` MUST be skipped — no `LogEntry` is produced for them. For each produced entry, `ingredient.amount` MUST equal `recipeIngredient.amount * (portions / recipe.yield)`. `ingredient.name`, `ingredient.unit`, and `ingredient.macrosPerUnit` MUST be copied from the recipe ingredient unchanged. Each entry MUST receive a fresh `id` and `loggedAt`.

Every entry produced by one invocation MUST additionally carry the **same fresh `recipeBatchId`**
(unique to this invocation) and `recipePortions` set to the requested `portions` (see "LogEntry
carries recipe batch metadata").

`portions` MUST be a positive number (floats allowed). `date` and `slot` follow the existing meal-log conventions.

When a recipe contains only untracked ingredients, the command MUST succeed and return an empty array. The command MUST NOT reject such a recipe — marinades, rubs, and seasoning blends are legitimate recipes that simply produce no log entries.

#### Scenario: Log a 4-yield recipe at 2 portions

- **GIVEN** a recipe yields 4 with two ingredients (200g rice, 100g chicken)
- **WHEN** the user logs 2 portions of it for `2026-04-28` lunch
- **THEN** two `LogEntry` rows are created with `amount` 100g and 50g respectively, both for `2026-04-28` / `lunch`, both carrying the recipe's `id` as `recipeId`, the same fresh `recipeBatchId`, and `recipePortions = 2`

#### Scenario: Two logs of the same recipe form distinct batches

- **WHEN** the user logs the same recipe twice into the same date+slot
- **THEN** the entries of the first invocation share one `recipeBatchId` and the entries of the second share a different one

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

The sub-step MUST preview exactly what will be logged: it lists only the recipe's **tracked**
ingredients, each with its amount scaled by `portions / yield` (untracked ingredients MUST NOT
appear in the preview, because no `LogEntry` is produced for them), states the count of tracked
ingredients that will be taken over, and explains that every ingredient lands as an individually
adjustable entry. The confirm button MUST be labelled "Zutaten übernehmen".

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

#### Scenario: Preview lists only tracked ingredients with scaled amounts

- **GIVEN** a recipe yields 1 with ingredients 5 g Salz (`untracked: true`) and 200 g Lachsfilet (tracked)
- **WHEN** the user opens the portions sub-step at 1 portion
- **THEN** the preview lists only "Lachsfilet — 200 g", states that 1 Zutat will be taken over, and Salz does not appear

#### Scenario: Preview rescales when portions change

- **GIVEN** the same recipe on the portions sub-step
- **WHEN** the user raises the portions to `2`
- **THEN** the preview lists "Lachsfilet — 400 g"

#### Scenario: Pick and confirm

- **WHEN** the user selects a recipe and submits the portions sub-step via "Zutaten übernehmen"
- **THEN** the sheet closes, `LogRecipe` is invoked with the sheet's `date` and `slot`, and the produced
  rows appear in the slot

#### Scenario: Back from the portions sub-step returns to the recipes list and restores the tabs

- **WHEN** the user is on the RecipePortionStep (reached from the Recipes tab) and activates the header
  back-arrow
- **THEN** the sheet returns to the Recipes tab list (not Search) and the tab bar is shown again

### Requirement: Daily log shows a visual hint for recipe-sourced entries

Entries that carry a `recipeBatchId` SHALL be rendered **grouped**: all entries of one batch appear
inside a single group card whose banner shows a recipe glyph, the source recipe's **current name**
(resolved live via `recipeId`), and the logged portion count (`{recipePortions} Port.`). The banner
also carries the batch-remove affordance (see "Remove a recipe-log batch atomically"). Entries
inside the group remain individually editable and removable, exactly like ungrouped entries. The
group MUST NOT repeat a per-row recipe hint on its member rows.

When the `recipeId` of a grouped batch does not resolve (the recipe was deleted), the group and its
banner MUST remain (grouping is driven by `recipeBatchId`), with a generic fallback label in place
of the recipe name.

Entries that carry a `recipeId` but **no** `recipeBatchId` (persisted before batch metadata
existed) MUST keep the previous behavior: a per-row hint labelled with the recipe's current name
when it resolves, no hint when it does not. The hint is purely informational: editing or removing
the entry MUST work identically whether or not it carries a `recipeId`.

This requirement applies wherever log entries are listed (daily log and the planner's day slots).

#### Scenario: Batch renders as a group with name and portions

- **GIVEN** a slot containing a 2-entry batch logged from recipe "Hähnchen mit Salz" at 1 portion
- **WHEN** the slot renders
- **THEN** both entries appear inside one group card whose banner shows "Hähnchen mit Salz" and "1 Port.", and neither member row shows its own recipe hint

#### Scenario: Renamed recipe reflects live in the banner

- **WHEN** the underlying recipe is renamed
- **THEN** the next render shows the new name in the group banner

#### Scenario: Deleted recipe — group survives with fallback label

- **WHEN** the underlying recipe of a batch is deleted
- **THEN** the group card and its rows remain, the banner shows a generic fallback label instead of the recipe name, and the rows stay editable/removable

#### Scenario: Legacy recipe-sourced entry keeps the per-row hint

- **WHEN** an entry carries a `recipeId` that resolves but no `recipeBatchId`
- **THEN** it renders ungrouped with the per-row hint labelled with the recipe's current name

#### Scenario: No hint for ad-hoc entries

- **WHEN** an entry has no `recipeId`
- **THEN** no recipe hint or grouping is applied
