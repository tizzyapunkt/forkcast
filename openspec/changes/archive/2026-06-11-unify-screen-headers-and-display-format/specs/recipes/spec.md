# recipes — delta

## MODIFIED Requirements

### Requirement: Recipe detail and editor header back navigation

The Recipe Detail (read) view and the Recipe Editor SHALL present their back/close affordance as a
single **header back-arrow**: a white arrow-only icon button (chevron-left) rendered inside the
indigo app header, to the **left of the in-header title** (see the `screen-headers` capability for
the header shape: entity title + optional subtitle live in the header, never as a body heading).
This REPLACES the previous in-content placement (arrow inline-left of a body heading). There MUST
be no `×` close button on these screens.

On the Recipe Detail the back-arrow returns to the recipes list. On the Recipe Editor the
back-arrow invokes the cancel handler (discarding the in-progress edit, with the existing
unsaved-changes guard if any). The arrow MUST have an accessible label.

#### Scenario: Recipe detail back-arrow returns to the list

- **WHEN** the user opens a recipe in read mode and activates the header back-arrow
- **THEN** the recipes list is shown again

#### Scenario: Recipe editor back-arrow cancels

- **WHEN** the user is in the Recipe Editor and activates the header back-arrow
- **THEN** the editor's cancel handler runs (the same as the existing "Abbrechen" action) and no `×`
  close button is present in the header

#### Scenario: Back arrow sits in the app header, not the body

- **WHEN** the user opens a recipe in read mode
- **THEN** the back arrow is rendered inside the indigo app header to the left of the recipe-name
  title, and the scroll body contains neither a back arrow nor a recipe-name heading

### Requirement: Recipes list row displays per-serving macros

The Recipes list (the screen reachable from the bottom navigation) SHALL render, for each recipe
row, a one-line per-serving macro summary derived from
`computeRecipeTotals(recipe.ingredients, recipe.yield).perServing`. The summary MUST display
calories and the three macro grams in the format
`{kcal} kcal · {P} P · {KH} KH · {F} F / Portion` — middot separators between the macro items,
the carbs label `KH`, integer-rounded values without a `g` suffix, and the trailing `/ Portion`
rate suffix. Untracked rows MUST NOT contribute to this rollup.

The macro line MUST appear in addition to (not in place of) the existing meta line
(`X Zutaten · Y Portionen`). The macro line MUST be readable at mobile width; numbers MUST use
tabular alignment so long names do not collapse the column.

#### Scenario: Recipe with tracked ingredients shows non-zero macros

- **GIVEN** a recipe with `yield = 2` whose tracked ingredients sum to `400 kcal · 40 P · 20 KH · 20 F` total
- **WHEN** the user opens the Recipes list
- **THEN** that recipe's row renders the macro line `200 kcal · 20 P · 10 KH · 10 F / Portion`

#### Scenario: Recipe with only untracked ingredients shows zero macros

- **GIVEN** a recipe whose every ingredient is untracked
- **WHEN** the user opens the Recipes list
- **THEN** that recipe's row renders the macro line `0 kcal · 0 P · 0 KH · 0 F / Portion`

#### Scenario: Existing meta line still rendered

- **WHEN** the Recipes list is shown
- **THEN** every row still renders the existing `X Zutaten · Y Portionen` meta line in addition to the new macro line

### Requirement: Recipes UI — serving multiplier on read view

The recipe read (cooking) view SHALL expose a servings multiplier control that lets the user pick the number of effective servings for which ingredient amounts are displayed. The control MUST default to the recipe's stored `yield`. When the chosen value differs from the stored `yield`, the view MUST render every ingredient row at the scaled value, where the scale factor is `chosenServings / recipe.yield`.

The scaling rule MUST match the existing `Yield scaling preserves piece quantities` requirement: each ingredient row's `amount`, (if present) `pieceQuantity.amount`, and (if present) `displayQuantity.amount` MUST be multiplied by the factor; `pieceQuantity.gramsPerPiece`, `pieceQuantity.unitLabel`, `displayQuantity.unitLabel`, `unit`, `name`, `macrosPerUnit`, and `untracked` MUST be invariant under scaling. Untracked rows MUST scale the same way as tracked rows; only the macro-rollup ignores `macrosPerUnit` for untracked rows.

The recipe's nutrition totals strip (see "Recipe read view displays per-serving nutrition totals") is **invariant under the multiplier** — the multiplier scales only the ingredient rows.

The chosen serving count MUST be ephemeral view state: it MUST NOT mutate the persisted recipe, MUST NOT trigger an API call, and MUST NOT survive navigating away from the read view. The control MUST allow the user to reset the value to the recipe's stored `yield` whenever the value differs.

The minimum selectable value MUST be `1`. There is no enforced maximum.

The cooking-step text MUST NOT be rescaled or modified — only the ingredient rows reflect the multiplier.

#### Scenario: Default matches stored yield

- **WHEN** the user opens a recipe with `yield = 2` in read mode and has not interacted with the multiplier
- **THEN** the multiplier control displays `2` and every ingredient row is rendered at its stored `amount`, `pieceQuantity.amount`, and `displayQuantity.amount` (no scaling applied)

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

#### Scenario: Untracked row with displayQuantity scales the displayed amount

- **GIVEN** a recipe with `yield = 2` and a row `{ amount: 0, unit: "g", untracked: true, displayQuantity: { amount: 1, unitLabel: "TL" } }`
- **WHEN** the user sets the multiplier to `4`
- **THEN** the row renders `2 TL` (muted, with untracked badge), and `displayQuantity.unitLabel` remains "TL"

#### Scenario: Untracked row without displayQuantity scales identically and stays muted

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
- **THEN** the step text still reads `"Add 1 chopped onion."` (only the ingredient rows reflect the new portion count)

#### Scenario: Multiplier does not mutate the persisted recipe

- **GIVEN** a recipe with `yield = 2`
- **WHEN** the user sets the multiplier to `4`, then leaves the read view and reopens the same recipe
- **THEN** no API call to update the recipe occurred, and on reopen the multiplier defaults to `2` again

#### Scenario: Multiplier does not affect logging or other features

- **GIVEN** a recipe with `yield = 2`
- **WHEN** the user sets the multiplier to `4` on the read view and then logs the recipe from elsewhere in the app
- **THEN** logging behaves exactly as before — the multiplier is purely a view-side concept on the read view

### Requirement: Recipe form displays live nutrition totals

The recipe create/edit form SHALL render the recipe's per-serving macros as a **Pro-Portion hero card at
the top of the form** (directly under the Name field), computed from the current in-memory `ingredients`
and `yield` state via `computeRecipeTotals`. The hero card MUST show:

- The eyebrow "Pro Portion" and the per-serving **kcal** as the headline number, with the three macros
  (Eiweiß / KH / Fett, each a coloured dot + value).
- The **servings count adjusted via a stepper co-located in the hero card** ("Ergibt [stepper]
  Portionen") — this stepper is the form's `yield` control (replacing the previous bare numeric input).
- A footer line "Gesamt {kcal} kcal für {n} Portion(en)" showing the full-recipe total.

The hero MUST update on every state change — adding, replacing, removing, or editing an ingredient,
switching an ingredient's measurement mode, or changing the servings count. Per-serving values MUST equal
`total / max(1, servings)`. The strip MUST NOT trigger any network call; computation is fully client-side.

#### Scenario: Hero renders at the top of the form with a servings stepper

- **WHEN** the recipe form is open
- **THEN** the Pro-Portion hero card is the first block under the Name field, and the servings count is
  adjusted via a stepper inside that card

#### Scenario: Totals update when an ingredient is added

- **GIVEN** the recipe form is open with an empty ingredient list and the hero shows `0 kcal` with macros `0 P · 0 KH · 0 F`
- **WHEN** the user adds an ingredient `{ amount: 100, macrosPerUnit: { calories: 2, protein: 0.2, carbs: 0, fat: 0 } }` to a recipe with `yield = 1`
- **THEN** the hero updates to `200 kcal` with macros `20 P · 0 KH · 0 F` per serving

#### Scenario: Totals update when an ingredient is switched to Frei

- **GIVEN** the form contains one tracked ingredient contributing 200 kcal per serving
- **WHEN** the user selects the **Frei** segment on that row
- **THEN** the hero updates to `0 kcal` with macros `0 P · 0 KH · 0 F` per serving (untracked rows are excluded)

#### Scenario: Totals update when an ingredient amount is edited

- **GIVEN** the form contains one tracked ingredient with `amount: 100` contributing 200 kcal per serving (yield 1)
- **WHEN** the user changes the amount to `150`
- **THEN** the hero updates to `300 kcal` with macros `30 P · 0 KH · 0 F` per serving

#### Scenario: Totals update when the servings stepper changes

- **GIVEN** the form contains a recipe with `total = 400 kcal` and `servings = 2`, showing `200 kcal` per serving
- **WHEN** the user increments the hero's servings stepper to `4`
- **THEN** the hero updates to `100 kcal` per serving (total unchanged) and the footer reads "Gesamt 400 kcal für 4 Portionen"

#### Scenario: Strip computation does not call the API

- **WHEN** the user interacts with any field in the recipe form
- **THEN** no request is sent to the backend solely to compute totals

### Requirement: Recipe ingredient editor shows per-row calories and macros for tracked ingredients

The recipe ingredient editor SHALL display each tracked ingredient row's calorie and macro contribution as a dedicated sub-line within the row. The sub-line MUST follow the format `{kcal} kcal · {P} P · {KH} KH · {F} F` — middot separators, carbs labelled `KH`, each value integer-rounded without a `g` suffix.

Per-row values MUST be derived as `ingredient.macrosPerUnit.{calories,protein,carbs,fat} * ingredient.amount`. The values MUST update synchronously when the user edits the amount input, the piece-count input, or the grams-per-piece input — no debounce, no save, no network call. The editor is already fully controlled by the parent form's state, so each valid keystroke that updates `ingredient.amount` MUST also produce the corresponding update of the per-row line on the same render.

The sub-line MUST NOT be rendered for any row whose `untracked === true`. Untracked rows MUST NOT show calories or macros — neither the stored `macrosPerUnit` (which is ignored at consume time) nor placeholder zeros — because doing so would misrepresent rows the system explicitly excludes from nutrition rollups.

This requirement applies to the editor as used in both the manual recipe form (create + edit) and the AI-import review screen (which mounts the same component).

#### Scenario: Tracked row shows kcal and macros

- **GIVEN** the recipe form contains a tracked ingredient with `macrosPerUnit = { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 }` and `amount = 200`
- **WHEN** the editor renders
- **THEN** the row displays `500 kcal · 52 P · 0 KH · 30 F` as a sub-line under the name/amount row

#### Scenario: Untracked row hides the macro line entirely

- **GIVEN** the recipe form contains an ingredient with `untracked = true` and any `macrosPerUnit` / `amount`
- **WHEN** the editor renders
- **THEN** no calorie or macro sub-line is shown for that row — neither the stored values nor zero placeholders

#### Scenario: Macro line updates live as the amount input changes

- **GIVEN** a tracked ingredient with `macrosPerUnit = { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 }` and `amount = 100`, showing `165 kcal · 31 P · 0 KH · 4 F`
- **WHEN** the user changes the amount input to `250`
- **THEN** the row's sub-line immediately reads `413 kcal · 78 P · 0 KH · 9 F`, on the same render as the input change — without any debounce, save, or network call

#### Scenario: Macro line updates live as the piece count changes

- **GIVEN** a tracked ingredient with `pieceQuantity = { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`, `unit: 'g'`, `amount: 150`, `macrosPerUnit = { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 }`
- **WHEN** the user changes the piece count to `2` (which sets `amount = 300`)
- **THEN** the row's sub-line immediately reads the kcal+macro values derived from `amount = 300`

## REMOVED Requirements

### Requirement: Recipe read view displays nutrition totals reactive to multiplier

**Reason**: Handoff 2 reduces the read view's nutrition strip to the single Pro-Portion line
(decided 2026-06-11) — the secondary `Bei {N} Portionen` scaled-total line is dropped, so the strip
is no longer reactive to the multiplier.

**Migration**: Replaced by "Recipe read view displays per-serving nutrition totals" (ADDED below).
The servings multiplier continues to scale ingredient rows per "Recipes UI — serving multiplier on
read view".

## ADDED Requirements

### Requirement: Recipe read view displays per-serving nutrition totals

The recipe read (cooking) view SHALL render a Pro-Portion strip near the top of the view (above the
ingredients section) showing the per-serving totals in the format
`{kcal} kcal · {P} P · {KH} KH · {F} F`, where the values equal
`computeRecipeTotals(recipe.ingredients, recipe.yield).perServing` (integer-rounded). The strip is
**invariant under the servings multiplier** — it always shows per-serving values for the stored
`yield`. Untracked ingredients MUST NOT contribute to the strip. The strip MUST NOT trigger any
API call; computation is purely client-side.

#### Scenario: Per-serving totals shown

- **GIVEN** a recipe with `yield = 2` whose tracked ingredients sum to `400 kcal · 40 P · 20 KH · 20 F` total
- **WHEN** the user opens the recipe in read mode
- **THEN** the strip shows `200 kcal · 20 P · 10 KH · 10 F`

#### Scenario: Strip is invariant under the multiplier

- **GIVEN** the same recipe open in read mode
- **WHEN** the user sets the servings multiplier to `4`
- **THEN** the strip still shows `200 kcal · 20 P · 10 KH · 10 F` (only the ingredient rows scale)

#### Scenario: Untracked rows excluded

- **GIVEN** a recipe with one tracked row contributing 200 kcal per serving and one untracked row whose `macrosPerUnit` would notionally contribute 100 kcal per serving
- **WHEN** the user opens the recipe in read mode
- **THEN** the strip shows `200 kcal` (the untracked row is excluded)
