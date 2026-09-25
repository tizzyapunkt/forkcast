## ADDED Requirements

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

## MODIFIED Requirements

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
