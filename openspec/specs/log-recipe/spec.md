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

### Requirement: Remove a recipe-log batch atomically

The system SHALL expose a command `RemoveRecipeLog` that, given a `recipeBatchId` and a `date`, deletes
**all** `LogEntry` rows on that `date` carrying that `recipeBatchId` in a single atomic write — either
every row of the batch on that date is removed or none (mirroring `LogRecipe`'s atomic insert). Entries
carrying the same `recipeBatchId` on **other dates** (e.g. from a day copied before copies received
fresh batch ids) MUST NOT be removed. A batch id that matches no entries on `date` MUST fail with a
not-found error. The system SHALL expose a matching HTTP endpoint `POST /remove-recipe-log` with body
`{ recipeBatchId, date }`; a missing `recipeBatchId` or `date` MUST be rejected with `400`.

In the UI (daily log and planner), the group banner of a batch SHALL expose a single remove
affordance that invokes this command for the batch's date; removing the batch MUST NOT affect entries
outside the batch. Removing individual entries inside the batch continues to work per "Editing
recipe-sourced entries leaves the link intact".

#### Scenario: Batch removed atomically

- **GIVEN** a slot containing a 3-entry recipe batch and one ad-hoc entry
- **WHEN** the user activates the group's remove affordance
- **THEN** all 3 batch entries are deleted in one atomic operation and the ad-hoc entry is unaffected

#### Scenario: Removal is scoped to the batch's date

- **GIVEN** Monday and Tuesday each hold a 2-entry batch sharing one `recipeBatchId` (a day copied before
  this change)
- **WHEN** the user removes the batch on Tuesday
- **THEN** Tuesday's 2 entries are deleted and Monday's 2 entries remain

#### Scenario: Unknown batch id rejected

- **WHEN** `RemoveRecipeLog` is invoked with a `recipeBatchId` that matches no entries on `date`
- **THEN** the command fails with a not-found error and nothing is deleted

#### Scenario: Missing date rejected

- **WHEN** a client sends `POST /remove-recipe-log` with a `recipeBatchId` but no `date`
- **THEN** the response is `400` and nothing is deleted

#### Scenario: Slot totals update after batch removal

- **WHEN** a batch is removed from a slot
- **THEN** the slot's displayed kcal/macro totals reflect the remaining entries on the next render

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

### Requirement: Editing recipe-sourced entries leaves the link intact
The user SHALL be able to edit (e.g. change `amount`) or remove a `LogEntry` regardless of whether it has a `recipeId`. Editing MUST NOT clear `recipeId`; the entry continues to display the recipe hint. Removing the entry simply deletes that one row and leaves all other recipe-sourced rows unaffected. This supports the "swap an ingredient on the fly" use case: if an ingredient was unavailable, the user can edit just that row, or — for entries in a recipe batch — replace its food (see "Replace an ingredient in a logged recipe batch"), without touching the recipe definition. Neither an amount edit nor a replace MUST clear `recipeId`, `recipeBatchId` or `recipePortions`.

#### Scenario: Edit amount, link preserved
- **WHEN** the user edits the `amount` of a recipe-sourced `LogEntry`
- **THEN** the entry persists with the new amount AND its original `recipeId`, and the recipe hint still appears

#### Scenario: Replace food, batch link preserved
- **WHEN** the user replaces the food of an entry in a recipe batch
- **THEN** the entry persists with the new food AND its original `recipeId`, `recipeBatchId` and `recipePortions`

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

### Requirement: Replace an ingredient in a logged recipe batch

The system SHALL expose a command `ReplaceBatchIngredient` that, given `{ entryId, ingredient }` where
`ingredient` is a **full** ingredient (`name`, `unit`, `macrosPerUnit`, `amount`), swaps the food of one
`LogEntry` that belongs to a recipe batch. The entry's `ingredient` MUST be replaced by the given one,
and the entry MUST keep its `id`, `date`, `slot`, `recipeId`, `recipeBatchId` and `recipePortions`, so it
stays in its batch. Its `loggedAt` MUST be set to the time of the replace, so the new food counts as
recently used. The source recipe definition MUST NOT be changed.

The command MUST fail with a not-found error when no entry has `entryId`, and with a validation error —
changing nothing — when the entry carries no `recipeBatchId` (ad-hoc and legacy recipe entries are
edited through the existing flows), when the given ingredient is not a full ingredient, or when its
`amount` is not a positive number.

The system SHALL expose this as `POST /replace-batch-ingredient` with body `{ entryId, ingredient }`,
returning the updated `LogEntry` on success, `404` for an unknown entry and `400` for any validation
failure.

#### Scenario: Swap Hackfleisch for Tofu inside a Chili batch

- **GIVEN** a dinner slot on `2026-09-29` with a 3-entry Chili batch (Hackfleisch 250 g, Kidneybohnen
  200 g, Passata 250 g) logged at 1 portion
- **WHEN** the user replaces the Hackfleisch entry with Tofu at 250 g
- **THEN** that entry now reads Tofu, 250 g, with Tofu's unit and macros per unit, and still carries the
  batch's `recipeId`, `recipeBatchId` and `recipePortions = 1`, the same `id`, `date` and `slot`

#### Scenario: Replaced entry stays in the group

- **WHEN** an entry of a batch has been replaced
- **THEN** the slot renders it inside the batch's group card, not as a loose row

#### Scenario: Recipe definition untouched

- **WHEN** an ingredient of a logged batch is replaced
- **THEN** the source recipe still lists its original ingredient, and the next log of that recipe
  produces the original ingredient

#### Scenario: Replaced food appears in Zuletzt

- **WHEN** the user replaces an entry's food with Tofu
- **THEN** Tofu appears as the most recently used ingredient in the add-food sheet's Zuletzt tab

#### Scenario: Ad-hoc entry rejected

- **WHEN** `ReplaceBatchIngredient` targets an entry without a `recipeBatchId`
- **THEN** the command fails with a validation error and the entry is unchanged

#### Scenario: Unknown entry rejected

- **WHEN** `POST /replace-batch-ingredient` names an `entryId` that does not exist
- **THEN** the response is `404` and nothing changes

#### Scenario: Non-positive amount rejected

- **WHEN** `POST /replace-batch-ingredient` carries an ingredient with `amount <= 0`
- **THEN** the response is `400` and the entry is unchanged

### Requirement: Add an ingredient to a logged recipe batch

The system SHALL expose a command `AddToRecipeBatch` that, given `{ recipeBatchId, date, ingredient }`
where `ingredient` is a **full** ingredient, creates one new `LogEntry` that joins the batch identified by
`recipeBatchId` on `date`. The new entry MUST get a fresh `id` and `loggedAt`, and MUST take `date`,
`slot`, `recipeId`, `recipeBatchId` and `recipePortions` from the batch's existing entries on that date.
Other entries MUST be unaffected, and the source recipe definition MUST NOT be changed.

The command MUST fail with a not-found error when no entry on `date` carries `recipeBatchId`, and with a
validation error — creating nothing — when the ingredient is not a full ingredient or its `amount` is
not a positive number.

The system SHALL expose this as `POST /add-to-recipe-batch` with body `{ recipeBatchId, date, ingredient }`,
returning the created `LogEntry` on success, `404` for an unknown batch and `400` for any validation
failure.

#### Scenario: Add spinach to a planned Chili

- **GIVEN** a dinner slot on `2026-09-29` with a Chili batch logged at 2 portions
- **WHEN** the user adds Spinat at 100 g to that batch
- **THEN** a new entry Spinat 100 g exists for `2026-09-29` / dinner, carrying the batch's `recipeId`,
  `recipeBatchId` and `recipePortions = 2`, and the batch's other entries are unchanged

#### Scenario: Added entry renders inside the group

- **WHEN** an ingredient has been added to a batch
- **THEN** the slot renders it inside that batch's group card, and the slot's totals include it

#### Scenario: Batch removal takes the added entry with it

- **GIVEN** a batch to which Spinat was added
- **WHEN** the user removes the batch from its banner
- **THEN** the added Spinat entry is deleted together with the batch's other entries

#### Scenario: Batch identity is scoped to the date

- **GIVEN** a day copied onto the next day, so both days hold entries sharing one `recipeBatchId`
- **WHEN** the user adds an ingredient to the batch on the second day
- **THEN** exactly one entry is created, on the second day, and the first day is unchanged

#### Scenario: Unknown batch rejected

- **WHEN** `POST /add-to-recipe-batch` names a `recipeBatchId` with no entries on `date`
- **THEN** the response is `404` and no entry is created

#### Scenario: Non-positive amount rejected

- **WHEN** `POST /add-to-recipe-batch` carries an ingredient with `amount <= 0`
- **THEN** the response is `400` and no entry is created

### Requirement: Replace and add affordances on recipe batches

Wherever log entries are listed — the daily log and the planner's day slots — a recipe batch group
SHALL offer:

- on **each row inside the group**, a replace affordance (accessible name "Zutat „{name}“ ersetzen")
- on the **group banner**, an add affordance (accessible name "Zutat zu „{recipe}“ hinzufügen")

Both MUST open the add-food sheet in a **batch-targeted mode**. In that mode the sheet's title names the
action and the recipe (e.g. "Zutat ersetzen — Chili" / "Zutat hinzufügen — Chili"), and only the
**Search, Favoriten and Zuletzt** tabs are offered — Rezepte and Schnell are not, because only a single
full ingredient can join a batch. Untracked search results remain un-selectable, exactly as in the
normal log flow. Picking a food leads to the existing amount step; confirming invokes
`ReplaceBatchIngredient` (replace) or `AddToRecipeBatch` (add) instead of logging an ad-hoc entry.

For a replace, the amount step MUST be pre-filled with the replaced entry's amount when the picked food
has the same unit; otherwise it follows the food's normal default (last-used amount from Zuletzt,
otherwise empty).

Rows outside a batch (ad-hoc entries, legacy recipe entries without batch metadata) MUST NOT show the
replace affordance. After either action, the daily log, the planner and Zuletzt MUST reflect the change
without a manual refresh.

#### Scenario: Replace from the daily log

- **GIVEN** the daily log for today shows a Chili batch with a Hackfleisch row
- **WHEN** the user activates "Zutat „Hackfleisch“ ersetzen", searches Tofu, and confirms
- **THEN** the row reads Tofu inside the Chili group and the day's totals reflect Tofu's macros

#### Scenario: Replace from the planner

- **GIVEN** the planner shows next Tuesday expanded with a Chili batch in dinner
- **WHEN** the user replaces the Hackfleisch row with Tofu
- **THEN** the row reads Tofu inside the Chili group, and the diary for that Tuesday shows the same

#### Scenario: Add from the banner

- **WHEN** the user activates "Zutat zu „Chili“ hinzufügen" and logs Spinat at 100 g
- **THEN** Spinat appears as a row inside the Chili group

#### Scenario: Batch-targeted sheet offers only single-ingredient sources

- **WHEN** the add-food sheet opens in replace or add mode
- **THEN** it shows the Search, Favoriten and Zuletzt tabs and does not show Rezepte or Schnell

#### Scenario: Replace pre-fills the amount for a same-unit food

- **GIVEN** a batch row Hackfleisch 250 g
- **WHEN** the user picks Tofu (unit g) as its replacement
- **THEN** the amount step opens with 250 pre-filled

#### Scenario: No replace affordance on ad-hoc rows

- **WHEN** a slot contains an ad-hoc entry next to a recipe batch
- **THEN** only the rows inside the batch show the replace affordance

#### Scenario: Cancel changes nothing

- **WHEN** the user opens the sheet in replace or add mode and closes it without confirming
- **THEN** the batch is unchanged

### Requirement: Cooked portions of a recipe batch

A recipe batch SHALL carry a **cooked portions** value: how many portions are cooked, as opposed to
`recipePortions`, the portions logged as eaten. It is stored as an optional `cookedPortions?: number`
on every `LogEntry` of the batch. When absent, the batch's cooked portions equal its `recipePortions`.
Cooked portions MUST NOT affect any nutrition value: entry, slot, day and week totals stay based on
logged amounts. Entries persisted before this change MUST load unchanged.

The system SHALL expose a command `SetCookedPortions` that, given `{ recipeBatchId, date, cookedPortions }`,
sets `cookedPortions` on every entry of that batch on `date`, and on no entry on another date. The value
MUST be a positive number **not below** the batch's `recipePortions`. The command MUST fail with a
validation error otherwise, and with a not-found error when no entry on `date` carries `recipeBatchId`.
It SHALL be exposed as `POST /set-cooked-portions` (`200` with the updated entries, `400`, `404`).

Every entry that joins a batch afterwards (via "Add an ingredient to a logged recipe batch") MUST take
the batch's `cookedPortions`, so all entries of a batch on a date always agree. Copying a day MUST keep
`cookedPortions` on the copied batch.

In the UI (daily log and planner), the batch banner SHALL show the cooked portions when they differ
from the logged portions (e.g. "1 Port. · für 2 gekocht") and SHALL offer a control to change them.
The control MUST NOT offer values below the logged portions.

#### Scenario: Cook for two, eat one

- **GIVEN** a Chili batch on `2026-09-29` logged at 1 portion
- **WHEN** the user sets its cooked portions to 2
- **THEN** every entry of that batch on `2026-09-29` carries `cookedPortions = 2`, the banner shows
  "1 Port. · für 2 gekocht", and the day's kcal and macro totals are unchanged

#### Scenario: Default equals logged portions

- **WHEN** a recipe is logged at 2 portions
- **THEN** its banner shows only "2 Port." and the batch's cooked portions are 2

#### Scenario: Below logged portions rejected

- **GIVEN** a batch logged at 2 portions
- **WHEN** `POST /set-cooked-portions` sets `cookedPortions = 1`
- **THEN** the response is `400` and nothing changes

#### Scenario: Unknown batch rejected

- **WHEN** `POST /set-cooked-portions` names a batch with no entries on `date`
- **THEN** the response is `404`

#### Scenario: Added ingredient follows the batch

- **GIVEN** a batch cooked for 3
- **WHEN** the user adds Spinat to the batch
- **THEN** the new Spinat entry carries `cookedPortions = 3`

#### Scenario: Copy keeps cooked portions

- **GIVEN** Monday's Chili batch cooked for 2
- **WHEN** Monday is copied onto Tuesday
- **THEN** Tuesday's copied Chili batch is also cooked for 2

#### Scenario: Set from the planner

- **GIVEN** the planner shows next Tuesday with a Chili batch
- **WHEN** the user raises its cooked portions to 2 from the banner
- **THEN** the banner shows "für 2 gekocht" there and in the daily log for that Tuesday
