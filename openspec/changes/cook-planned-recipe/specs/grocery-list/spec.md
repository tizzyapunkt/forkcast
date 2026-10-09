# Spec Delta

## MODIFIED Requirements

### Requirement: Grocery list for a week

The system SHALL expose a query that, given a `startDate` (ISO date) and optional **cooked portions per
recipe**, returns the grocery list for the seven days `startDate` … `startDate + 6`. It MUST read the
existing meal log and recipes and persist nothing. Each call is computed fresh.

A recipe's **logged portions** in the week are the sum of `recipePortions` over that recipe's batches in
the week, each batch (`date` + `recipeBatchId`) counted once. Its **portions** (the portions cooked) are the value passed for
it, defaulting to its logged portions. Portions passed for a recipe that has no batch in the week are
ignored. A portion value MUST be a positive number.

The list is made of the following contributions:

- **Ad-hoc full entries** (no `recipeBatchId`, including legacy recipe entries without batch metadata)
  contribute their `amount` unchanged.
- **Entries of a recipe batch** contribute `amount × portions / logged portions` of their recipe. This
  applies equally to entries that were replaced in or added to the batch. When the recipe no longer
  exists, its batches' entries contribute their `amount` unchanged.
- **Untracked ingredients of a recipe** (recipe ingredients with `untracked: true`, which never become
  log entries) contribute `recipeIngredient.amount × portions / recipe.yield`, **once per recipe** in the
  week. When the recipe no longer exists, it contributes no untracked ingredients.
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
  (case-insensitive) has piece sizes. The hint uses the medium piece (labelled `mittel`, ending in
  ` mittel` such as `Filet mittel`, or `M`), else the largest piece — a whole head, not its florets —
  and gives `count = ⌈total / piece grams⌉` with that piece's label.

Items MUST be ordered with tracked items first, then untracked items, each group alphabetically by name.
A week with nothing to buy MUST return an empty item list, not an error.

The result MUST also list the week's **recipes**: one per existing recipe with a batch in the week,
carrying its id, name, logged portions and the portions used, ordered by name.

The system SHALL expose this as `GET /grocery-list/{startDate}` with an optional query parameter
`portions=<recipeId>:<number>,…`, returning `200` with the list, or `400` for a malformed date or
portions value.

#### Scenario: Ad-hoc entries summed across days

- **GIVEN** Haferflocken 60 g logged on each of Monday to Friday of the week
- **WHEN** the grocery list for that week is requested
- **THEN** it contains one Haferflocken item of 300 g whose dates are those five days

#### Scenario: Recipe batch scaled by cooked portions

- **GIVEN** Pasta is planned on Monday and Wednesday at 1 portion each, each batch with Ketchup 50 ml
- **WHEN** the grocery list is requested with portions 4 for Pasta
- **THEN** Ketchup contributes 200 ml

#### Scenario: Cooked portions default to logged portions

- **GIVEN** a recipe logged at 2 portions in the week and no portions passed for it
- **WHEN** the grocery list is requested
- **THEN** its batch entries contribute their logged amounts unchanged and the recipe is listed with
  portions 2

#### Scenario: Swapped and added batch entries scale with the batch

- **GIVEN** a Chili batch logged at 1 portion in which Hackfleisch was replaced by Tofu 250 g and Spinat
  100 g was added
- **WHEN** the grocery list is requested with portions 2 for Chili
- **THEN** Tofu contributes 500 g, Spinat contributes 200 g, and Hackfleisch does not appear

#### Scenario: Untracked recipe ingredients are included

- **GIVEN** a recipe yielding 2 with Salz 5 g (`untracked: true`) and Lachsfilet 400 g, planned on two
  days at 1 portion each
- **WHEN** the grocery list is requested with portions 4 for that recipe
- **THEN** it contains Lachsfilet 800 g as a tracked item and Salz 10 g as an untracked item

#### Scenario: Deleted recipe contributes no untracked ingredients

- **GIVEN** a batch whose recipe has since been deleted
- **WHEN** the grocery list is requested
- **THEN** the batch's logged entries contribute unchanged, no untracked items come from it, and the
  recipe is not listed

#### Scenario: Portions for a recipe not in the week ignored

- **WHEN** the grocery list is requested with portions for a recipe that has no batch in the week
- **THEN** the response is `200` and that value has no effect

#### Scenario: Invalid portions rejected

- **WHEN** a client sends `GET /grocery-list/2026-10-12?portions=abc:0`
- **THEN** the response is `400`

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

#### Scenario: Whole piece without a medium size

- **GIVEN** a catalog food Brokkoli (unit g) with pieces Röschen 30 g and Kopf 500 g, and 700 g of
  Brokkoli across the week
- **WHEN** the grocery list is requested
- **THEN** the Brokkoli item carries the piece hint 2 × Kopf

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
- **THEN** the response is `200` with no items, no recipes and 0 skipped quick entries

#### Scenario: Malformed date rejected

- **WHEN** a client sends `GET /grocery-list/next-week`
- **THEN** the response is `400`

### Requirement: Einkaufsliste in the planner

The planner SHALL offer an **Einkaufsliste** action for the week it currently shows. Activating it MUST
open a sheet that loads the grocery list for that week's `startDate` and shows:

- the week range in the title
- a **portions input per recipe** of the week, above the items, each starting at the recipe's logged
  portions. Changing one reloads the list with the new portions. The values live only as long as the
  sheet is open: reopening starts again at the logged portions.
- tracked items first, then untracked items under their own heading (e.g. "Gewürze & Kleinkram")
- for each item: its name, its amount with unit, the piece hint when present (e.g. "380 g · ≈ 3 Stück"),
  and the weekday abbreviations that need it (e.g. "Mo, Di, Do")
- a note when quick entries were skipped (e.g. "2 Schnelleinträge nicht enthalten")
- an empty state when there is nothing to buy

Every item MUST start **unticked**: everything is on the list. The user ticks off items they already
have at home, which strikes them through. The tick state lives only as long as the sheet is open and
MUST survive a change of portions: closing and reopening starts again with nothing ticked off.

A **Kopieren** action MUST copy the items not ticked off to the clipboard as plain text, one item per line
(`{name} — {amount} {unit}`, with the piece hint appended when present), and confirm the copy. With
every item ticked off, the action MUST be disabled.

#### Scenario: Opens for the week in view

- **GIVEN** the planner shows the week starting `2026-09-28`
- **WHEN** the user activates Einkaufsliste
- **THEN** the sheet shows the grocery list for `2026-09-28` … `2026-10-04`

#### Scenario: Navigating weeks changes the list

- **GIVEN** the user navigated the planner to next week
- **WHEN** they open Einkaufsliste
- **THEN** the list is the one for next week, not the current week

#### Scenario: Portions start at the logged portions

- **GIVEN** Pasta is planned twice in the week at 1 portion each
- **WHEN** the sheet opens
- **THEN** Pasta's portions input shows 2

#### Scenario: Cooking for a partner

- **GIVEN** the sheet shows Pasta at 2 portions with Ketchup 100 ml
- **WHEN** the user sets Pasta to 4 portions
- **THEN** the list reloads and Ketchup reads 200 ml

#### Scenario: Ticks survive a portions change

- **GIVEN** Olivenöl is ticked off
- **WHEN** the user changes a recipe's portions
- **THEN** Olivenöl is still ticked off

#### Scenario: Portions reset on reopen

- **WHEN** the user changes a recipe's portions, closes the sheet and opens it again
- **THEN** the portions input shows the logged portions again

#### Scenario: Nothing starts ticked off

- **WHEN** the sheet opens
- **THEN** no item is ticked off

#### Scenario: Tick off and copy

- **GIVEN** the sheet lists Hähnchenbrust, Zwiebel and Olivenöl
- **WHEN** the user ticks off Olivenöl and activates Kopieren
- **THEN** the clipboard holds the lines for Hähnchenbrust and Zwiebel only, and a confirmation is shown

#### Scenario: Ticks reset on reopen

- **WHEN** the user ticks off an item, closes the sheet and opens it again
- **THEN** no item is ticked off

#### Scenario: Untracked items in their own section

- **WHEN** the list contains Salz as an untracked item
- **THEN** Salz appears below the tracked items under the untracked heading

#### Scenario: Empty week

- **WHEN** the user opens Einkaufsliste for a week with no entries
- **THEN** an empty state is shown and Kopieren is disabled
