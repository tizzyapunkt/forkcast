# cooking-session Specification

## Purpose
Cook one planned recipe once for several of its planned meals in a week and for people eating along:
see the whole pot, adjust it while cooking, and have the plan follow by portion.

## Requirements

### Requirement: Open a cooking session from the planner

Every recipe batch in the planner SHALL offer a **Kochen** action on its group banner. It MUST open the
cooking view for that batch's recipe in the week the planner shows, as a full-screen sub-screen with the
bottom navigation hidden and a back action to the planner. Batches without a `recipeId` offer no action.

#### Scenario: Open from a planned batch

- **GIVEN** the planner shows the week of `2026-10-12` with a Pasta batch on Monday dinner
- **WHEN** the user activates Kochen on that batch's banner
- **THEN** the cooking view opens for Pasta in the week `2026-10-12` … `2026-10-18`

#### Scenario: Back returns to the planner

- **WHEN** the user leaves the cooking view through its back action
- **THEN** the planner shows the same week again

### Requirement: Choose the batches a session covers

The cooking view SHALL list every batch of its recipe in its week (weekday, slot, logged portions) with a
toggle each. On open, batches dated today or later MUST be selected and earlier ones not; when no batch
is dated today or later, all MUST be selected. At least one batch MUST stay selected.

#### Scenario: Future batches preselected

- **GIVEN** today is Wednesday and Pasta is planned on Monday, Wednesday and Friday
- **WHEN** the cooking view opens
- **THEN** Wednesday and Friday are selected and Monday is not

#### Scenario: Past week selects everything

- **GIVEN** every Pasta batch of the week lies before today
- **WHEN** the cooking view opens
- **THEN** all of them are selected

#### Scenario: Last batch cannot be deselected

- **WHEN** only one batch is selected
- **THEN** its toggle cannot be turned off

### Requirement: Extra portions for people eating along

The cooking view SHALL offer an **extra portions** input, a whole number from `0`, starting at `0`. The
**pot portions** are the sum of the selected batches' `recipePortions` plus the extra portions. Extra
portions MUST NOT be written to the meal log.

#### Scenario: Partner eats along

- **GIVEN** two selected batches of 1 portion each
- **WHEN** the user sets extra portions to 2
- **THEN** the view cooks for 4 portions and no log entry changes

### Requirement: Pot amounts from the selected batches

For each ingredient identity (case-insensitive name plus unit) in the selected batches, the view SHALL
show the **pot amount** = (sum of its amounts in the selected batches ÷ sum of the selected batches'
`recipePortions`) × pot portions. An identity missing from some selected batches MUST say how many of
them contain it.

#### Scenario: Two planned meals cooked for four

- **GIVEN** Monday and Wednesday Pasta batches of 1 portion each, each with Ketchup 50 ml, and 2 extra portions
- **WHEN** the cooking view renders
- **THEN** Ketchup shows 200 ml

#### Scenario: Ingredient in only some batches

- **GIVEN** two selected batches of which only Monday's contains Parmesan 20 g
- **WHEN** the cooking view renders
- **THEN** the Parmesan row says it is in 1 of 2 meals

#### Scenario: Selection changes the pot

- **WHEN** the user deselects one of two equal batches
- **THEN** every pot amount is recomputed for the remaining batch plus the extra portions

### Requirement: Recipe drives presentation

Ingredient rows matching a recipe ingredient by identity SHALL follow the recipe's order and show its
note. A recipe `displayQuantity` with an amount or a `pieceQuantity` MUST be shown as a quantity
converted at the recipe's own rate, beside the amount. Identities not in the recipe MUST follow after,
marked as added, in their own unit.

#### Scenario: Spoon units scale with the pot

- **GIVEN** the recipe lists Olivenöl 30 g as 2 EL and the pot holds 60 g Olivenöl
- **WHEN** the cooking view renders
- **THEN** the Olivenöl row reads 4 EL alongside 60 g

#### Scenario: Swapped-in ingredient marked as added

- **GIVEN** Hackfleisch was replaced by Tofu in the planner
- **WHEN** the cooking view renders
- **THEN** Tofu appears after the recipe's ingredients, marked as added, in grams

### Requirement: Untracked ingredients shown read-only

The view SHALL list the recipe's untracked ingredients with amount = recipe amount × pot portions ÷
`recipe.yield` (a qualitative `displayQuantity` shows its label only). These rows MUST NOT offer
editing, swapping or removal and contribute no macros.

#### Scenario: Salt for four

- **GIVEN** a recipe yielding 2 with Salz 4 g untracked, cooked for 4 pot portions
- **WHEN** the cooking view renders
- **THEN** Salz shows 8 g with no edit, swap or remove action

### Requirement: Recipe steps and a missing recipe

The view SHALL show the recipe's steps as written, without scaling. When the recipe no longer exists, the
view MUST show the batches' logged ingredients in their own units, without steps and without untracked
ingredients, and editing MUST still work.

#### Scenario: Deleted recipe

- **GIVEN** the Pasta recipe was deleted after it was planned
- **WHEN** the cooking view opens for its batches
- **THEN** it lists the logged ingredients without steps, and amounts can still be changed

### Requirement: Macros per portion

The view SHALL show kcal, protein, carbs and fat **per portion**: the selected batches' entry totals ÷
the sum of their `recipePortions`. Extra portions MUST NOT change the value. It MUST update after every
edit and undo.

#### Scenario: More ketchup raises kcal per portion

- **GIVEN** the view shows 520 kcal per portion
- **WHEN** the user raises Ketchup from 200 ml to 400 ml
- **THEN** the per-portion kcal rises by the ketchup's added energy per portion

### Requirement: Change an ingredient's pot amount

Changing a row's pot amount SHALL set that identity in **every selected batch** to (new pot amount ÷ pot
portions) × that batch's `recipePortions`, adding it to selected batches that lack it. Unselected batches
and other identities MUST stay unchanged. The pot amount MUST be positive.

#### Scenario: Use the whole bottle

- **GIVEN** Monday and Wednesday batches of 1 portion with Ketchup 50 ml each and 2 extra portions
- **WHEN** the user changes Ketchup from 200 ml to 400 ml
- **THEN** Monday and Wednesday each log Ketchup 100 ml

#### Scenario: Uneven batches become even

- **GIVEN** selected batches with Ketchup 50 ml and 70 ml at 1 portion each and no extra portions
- **WHEN** the user sets Ketchup to 200 ml
- **THEN** both batches log Ketchup 100 ml

#### Scenario: Unselected batch untouched

- **GIVEN** Friday's Pasta batch is not selected
- **WHEN** the user changes Ketchup in the cooking view
- **THEN** Friday's Ketchup is unchanged

### Requirement: Swap an ingredient

The user SHALL be able to swap a tracked row for a food picked from search. The new pot amount MUST be
prefilled with the old one when the units match and left empty otherwise. Confirming removes the old
identity from every selected batch and sets the new one by portion. A target already present merges.

#### Scenario: Ketchup to Passata, same unit

- **GIVEN** Ketchup 400 ml in the pot
- **WHEN** the user swaps it for Passata (ml)
- **THEN** the amount is prefilled with 400 ml, and confirming replaces Ketchup by Passata 100 ml per logged portion in each selected batch

#### Scenario: Different unit needs an amount

- **WHEN** the user swaps Ketchup (ml) for Tomaten (g)
- **THEN** the amount field is empty and confirming is not possible until an amount is entered

#### Scenario: Swap into an ingredient already there

- **GIVEN** the pot holds Ketchup 200 ml and Passata 300 ml
- **WHEN** the user swaps Ketchup for Passata
- **THEN** the amount is prefilled with 500 ml, and confirming leaves one Passata row and no Ketchup row

### Requirement: Add and leave out ingredients

The user SHALL be able to add a food from search with a pot amount, written by portion to every selected
batch, and to leave out a tracked row, removing that identity from every selected batch.

#### Scenario: Add cream for four

- **GIVEN** pot portions 4 from two batches of 1 portion
- **WHEN** the user adds Sahne 200 ml
- **THEN** each selected batch logs Sahne 50 ml

#### Scenario: Leave out onions

- **WHEN** the user leaves out Zwiebel
- **THEN** no selected batch contains Zwiebel and unselected batches keep theirs

### Requirement: Set batch ingredients atomically

The system SHALL expose `SetBatchIngredients`, given a list of `{ recipeBatchId, date, remove, set }`: per
batch, every entry whose identity is in `remove` or `set` is dropped, then one entry per `set`
ingredient is written with the batch's slot and recipe metadata. All batches change or none; a change
leaving a batch empty is rejected. `POST /set-batch-ingredients`: `200`, `400`, `404`.

#### Scenario: Several dates in one write

- **WHEN** the command sets Ketchup 100 ml on batches dated Monday and Wednesday
- **THEN** both batches hold exactly one Ketchup entry of 100 ml

#### Scenario: Repeating the command changes nothing further

- **WHEN** the same command is sent twice
- **THEN** the batches end in the same state as after the first

#### Scenario: Unknown batch rejects everything

- **WHEN** one listed batch has no entries on its `date`
- **THEN** the response is `404` and no batch changes

#### Scenario: Invalid ingredient rejected

- **WHEN** a `set` ingredient has a non-positive amount or a missing name, unit or macros
- **THEN** the response is `400` and no batch changes

#### Scenario: Emptying a batch rejected

- **WHEN** the command would remove every entry of a listed batch
- **THEN** the response is `400` and no batch changes, and the cooking view offers no leave-out action
  on the last tracked row

### Requirement: Undo per changed row

Each row changed in the session SHALL offer an **undo** that restores the identities that row touched in
the selected batches to their state before the row's first change, independent of other rows. Undo
state MUST live only as long as the view is open.

#### Scenario: Undo one of two changes

- **GIVEN** the user changed Ketchup and then Zwiebel
- **WHEN** the user undoes Ketchup
- **THEN** Ketchup is back to its original amounts per batch and Zwiebel keeps its change

#### Scenario: Several changes, one undo

- **GIVEN** Zwiebel was changed three times
- **WHEN** the user undoes Zwiebel
- **THEN** Zwiebel is back to its state from before the first change

#### Scenario: Undo a swap

- **GIVEN** Ketchup was swapped for Passata
- **WHEN** the user undoes that row
- **THEN** the selected batches hold their original Ketchup again and Passata is gone or back to its original amount

#### Scenario: Undo is gone after a reload

- **WHEN** the page is reloaded during a session
- **THEN** the changes remain in the plan and no undo is offered for them

### Requirement: Session survives a reload

The cooking view SHALL keep its recipe, week, selected batches and extra portions in the page URL and
MUST restore them when the app loads with that URL. Leaving the view MUST remove them from the URL.

#### Scenario: Phone reloads mid-cooking

- **GIVEN** a session for Pasta with two batches selected and 2 extra portions
- **WHEN** the app reloads
- **THEN** the cooking view opens again with the same batches and 2 extra portions

### Requirement: Screen stays on while cooking

While the cooking view is open and visible, the app SHALL request a screen wake lock where the browser
supports it, request it again when the page becomes visible, release it on leaving, and show that the
screen stays on. Without support, the view MUST work unchanged without the indicator.

#### Scenario: Back from the timer app

- **GIVEN** the cooking view holds a wake lock
- **WHEN** the user switches to another app and back
- **THEN** the wake lock is requested again

#### Scenario: Unsupported browser

- **WHEN** the browser has no wake lock support
- **THEN** the cooking view works and shows no screen-on indicator
