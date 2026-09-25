# grocery-list Specification

## Purpose
Turns a planned week into what has to be bought for it. The list counts recipes at the portions actually
cooked and includes the untracked ingredients the meal log leaves out.

## Requirements

### Requirement: Grocery list for a week

The system SHALL expose a query that, given a `startDate` (ISO date), returns the grocery list for the
seven days `startDate` … `startDate + 6`. It MUST read the existing meal log and recipes and persist
nothing. Each call is computed fresh.

The list is made of the following contributions:

- **Ad-hoc full entries** (no `recipeBatchId`, including legacy recipe entries without batch metadata)
  contribute their `amount` unchanged.
- **Entries of a recipe batch** contribute `amount × cookedPortions / recipePortions`, where
  `cookedPortions` is the batch's cooked portions (defaulting to `recipePortions`). This applies equally
  to entries that were replaced in or added to the batch.
- **Untracked ingredients of a batch's recipe** (recipe ingredients with `untracked: true`, which never
  become log entries) contribute `recipeIngredient.amount × cookedPortions / recipe.yield`, once per
  batch. When the recipe no longer exists, the batch contributes no untracked ingredients.
- **Quick entries** contribute nothing. The result MUST state how many quick entries in the week were
  skipped.

Contributions MUST be combined into one **item** per food identity: case-insensitive name plus unit
(the same identity rule as recently used ingredients). Each item carries:

- the food's display name (the most recent contribution's spelling)
- the unit and the total amount, rounded **up** to a whole number
- whether it is **untracked**. An identity is untracked only when every contribution comes from an
  untracked recipe ingredient.
- the dates in the week that contribute to it, in ascending order
- a **piece hint** when the unit is `g` and a catalog food with the same name or synonym
  (case-insensitive) has piece sizes. The hint uses the piece labelled `mittel`, or the first piece when
  there is no `mittel`, and gives `count = ⌈total / piece grams⌉` with that piece's label.

Items MUST be ordered with tracked items first, then untracked items, each group alphabetically by name.
A week with nothing to buy MUST return an empty item list, not an error.

The system SHALL expose this as `GET /grocery-list/{startDate}`, returning `200` with the list, or `400`
for a malformed date.

#### Scenario: Ad-hoc entries summed across days

- **GIVEN** Haferflocken 60 g logged on each of Monday to Friday of the week
- **WHEN** the grocery list for that week is requested
- **THEN** it contains one Haferflocken item of 300 g whose dates are those five days

#### Scenario: Recipe batch scaled by cooked portions

- **GIVEN** Tuesday dinner holds a Chili batch logged at 1 portion with Hackfleisch 250 g and cooked
  portions set to 2
- **WHEN** the grocery list is requested
- **THEN** Hackfleisch contributes 500 g

#### Scenario: Cooked portions default to logged portions

- **GIVEN** a batch logged at 2 portions whose cooked portions were never set
- **WHEN** the grocery list is requested
- **THEN** its entries contribute their logged amounts unchanged

#### Scenario: Swapped and added batch entries scale with the batch

- **GIVEN** a Chili batch logged at 1 portion, cooked for 2, in which Hackfleisch was replaced by Tofu
  250 g and Spinat 100 g was added
- **WHEN** the grocery list is requested
- **THEN** Tofu contributes 500 g, Spinat contributes 200 g, and Hackfleisch does not appear

#### Scenario: Untracked recipe ingredients are included

- **GIVEN** a recipe yielding 2 with Salz 5 g (`untracked: true`) and Lachsfilet 400 g, logged at 1
  portion and cooked for 2
- **WHEN** the grocery list is requested
- **THEN** it contains Lachsfilet 400 g as a tracked item and Salz 5 g as an untracked item

#### Scenario: Deleted recipe contributes no untracked ingredients

- **GIVEN** a batch whose recipe has since been deleted
- **WHEN** the grocery list is requested
- **THEN** the batch's logged entries still contribute and no untracked items come from it

#### Scenario: Same food, different units stay separate

- **GIVEN** Milch 200 ml and Milch 100 g in the same week
- **WHEN** the grocery list is requested
- **THEN** they appear as two items

#### Scenario: Name matching ignores case

- **GIVEN** "Zwiebel" 80 g on Monday and "zwiebel" 120 g on Thursday
- **WHEN** the grocery list is requested
- **THEN** one item of 200 g appears with both dates

#### Scenario: Piece hint from the catalog

- **GIVEN** a catalog food Zwiebel (unit g) with pieces klein 110 g, mittel 180 g and 380 g of Zwiebel
  across the week
- **WHEN** the grocery list is requested
- **THEN** the Zwiebel item carries the piece hint 3 × mittel

#### Scenario: Amounts rounded up

- **GIVEN** a batch contribution of 133.4 g Reis
- **WHEN** the grocery list is requested
- **THEN** the Reis item reads 134 g

#### Scenario: Quick entries skipped and counted

- **GIVEN** two quick entries in the week
- **WHEN** the grocery list is requested
- **THEN** no item comes from them and the result reports 2 skipped quick entries

#### Scenario: Only the requested week counts

- **GIVEN** entries on the Sunday before and the Monday after the requested week
- **WHEN** the grocery list is requested
- **THEN** neither contributes

#### Scenario: Empty week

- **WHEN** the grocery list is requested for a week with no entries
- **THEN** the response is `200` with no items and 0 skipped quick entries

#### Scenario: Malformed date rejected

- **WHEN** a client sends `GET /grocery-list/next-week`
- **THEN** the response is `400`

### Requirement: Einkaufsliste in the planner

The planner SHALL offer an **Einkaufsliste** action for the week it currently shows. Activating it MUST
open a sheet that loads the grocery list for that week's `startDate` and shows:

- the week range in the title
- tracked items first, then untracked items under their own heading (e.g. "Gewürze & Kleinkram")
- for each item: its name, its amount with unit, the piece hint when present (e.g. "380 g · ≈ 3 Stück"),
  and the weekday abbreviations that need it (e.g. "Mo, Di, Do")
- a note when quick entries were skipped (e.g. "2 Schnelleinträge nicht enthalten")
- an empty state when there is nothing to buy

Every item MUST start **checked**, and the user can untick items they already have. The tick state lives
only as long as the sheet is open: closing and reopening starts again with everything checked.

A **Kopieren** action MUST copy the checked items to the clipboard as plain text, one item per line
(`{name} — {amount} {unit}`, with the piece hint appended when present), and confirm the copy. With
nothing checked, the action MUST be disabled.

#### Scenario: Opens for the week in view

- **GIVEN** the planner shows the week starting `2026-09-28`
- **WHEN** the user activates Einkaufsliste
- **THEN** the sheet shows the grocery list for `2026-09-28` … `2026-10-04`

#### Scenario: Navigating weeks changes the list

- **GIVEN** the user navigated the planner to next week
- **WHEN** they open Einkaufsliste
- **THEN** the list is the one for next week, not the current week

#### Scenario: Everything starts checked

- **WHEN** the sheet opens
- **THEN** every item is checked

#### Scenario: Untick and copy

- **GIVEN** the sheet lists Hähnchenbrust, Zwiebel and Olivenöl
- **WHEN** the user unticks Olivenöl and activates Kopieren
- **THEN** the clipboard holds the lines for Hähnchenbrust and Zwiebel only, and a confirmation is shown

#### Scenario: Ticks reset on reopen

- **WHEN** the user unticks an item, closes the sheet and opens it again
- **THEN** every item is checked again

#### Scenario: Untracked items in their own section

- **WHEN** the list contains Salz as an untracked item
- **THEN** Salz appears below the tracked items under the untracked heading

#### Scenario: Empty week

- **WHEN** the user opens Einkaufsliste for a week with no entries
- **THEN** an empty state is shown and Kopieren is disabled
