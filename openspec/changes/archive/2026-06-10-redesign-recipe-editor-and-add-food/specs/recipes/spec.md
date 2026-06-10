## ADDED Requirements

### Requirement: Recipe form ingredient measurement-mode control
The recipe ingredient editor (used by both the manual recipe form and the AI-import review screen) SHALL
render, on every ingredient row, a single **segmented measurement-mode control** with exactly three
mutually-exclusive modes: **Gewicht** (weight), **Stück** (piece), and **Frei** (free / not counted).
Exactly one mode is active per row. This control REPLACES the previous separate affordances — the
`"+ pro Stück"` piece-attach button and the `"Nicht zählen"` pill toggle — consolidating them into one
selector.

The active mode is **derived from the row's data**, not stored as a separate field:
- `pieceQuantity` present → **Stück**.
- else `untracked === true` → **Frei**.
- else → **Gewicht**.

Below the control, a **mode body** renders only the inputs the active mode needs:
- **Gewicht:** the mass `amount` number input + the unit label, plus the existing per-row kcal/macro
  sub-line. Contributes `macrosPerUnit × amount` to nutrition.
- **Stück:** a count stepper × a free-text piece-name input (e.g. `"großes Ei"`) × an editable
  grams-per-piece input, with a live `= {grams} {unit} · {kcal} kcal` readout. Writes `pieceQuantity`
  and keeps `amount = count × gramsPerPiece`. This is **tracked** nutrition entered by piece. Editing
  the count or the grams-per-piece recomputes `amount`; the per-row macro sub-line updates live.
- **Frei:** a free amount input + a free-text unit input (placeholder `"Einheit — z. B. TL, Prise, nach
  Geschmack"`) and the caption `"Zählt nicht in die Nährwerte — nur als Hinweis im Rezept."` The row is
  `untracked: true` and contributes **zero** to nutrition. The amount + unit map onto `displayQuantity`
  **only when the unit label is non-empty after trim**; with an empty unit label no `displayQuantity` is
  written and the canonical `amount`/`unit` is shown (muted).

Switching the active mode MUST seed the row deterministically:
- **→ Gewicht:** clear `pieceQuantity`, set `untracked: false`, drop `displayQuantity`; `amount`/`unit`
  are preserved.
- **→ Stück:** set `untracked: false`, drop `displayQuantity`; if no `pieceQuantity` exists, seed
  `pieceQuantity = { amount: 1, unitLabel: "Stück", gramsPerPiece: (current amount || 50) }` and set
  `amount = pieceQuantity.amount × pieceQuantity.gramsPerPiece`. An existing `pieceQuantity` is kept
  verbatim.
- **→ Frei:** set `untracked: true`, clear `pieceQuantity`. Any existing `displayQuantity` is preserved.

The **Stück** segment MUST be available only when the row's `unit` is `g` or `ml` (the existing
`pieceQuantity` invariant). On any other unit the Stück segment MUST be disabled.

The persisted shape and all validation of `pieceQuantity`, `untracked`, and `displayQuantity` are
unchanged and remain governed by the `Recipe entity shape`, `Untracked ingredient displayQuantity`, and
`Recipe form displayQuantity editor` requirements. This requirement governs only the in-form control.

The active-segment styling (white segment, card shadow) MUST change instantly on selection; only text
`color` MAY be transitioned — `background`/`box-shadow` MUST NOT be transitioned (animating them toward
`transparent`/`none` sticks in some engines and reads as a broken toggle).

#### Scenario: Mode derived from row data
- **GIVEN** three rows: one with `pieceQuantity` set, one with `untracked: true` and no `pieceQuantity`,
  and one plain mass row
- **THEN** their measurement-mode controls show **Stück**, **Frei**, and **Gewicht** active respectively

#### Scenario: Switching to Stück seeds piece tracking
- **GIVEN** a Gewicht row `{ name: "Ei", unit: "g", amount: 60 }`
- **WHEN** the user selects the **Stück** segment
- **THEN** the row gains `pieceQuantity = { amount: 1, unitLabel: "Stück", gramsPerPiece: 60 }` with
  `amount = 60`, and the Stück body (count × piece-name × grams-per-piece) is shown

#### Scenario: Switching to Stück on a row with amount zero uses the fallback grams-per-piece
- **GIVEN** a Gewicht row whose `amount` is `0`
- **WHEN** the user selects the **Stück** segment
- **THEN** the seeded `pieceQuantity.gramsPerPiece` is `50` and `amount` becomes `50`

#### Scenario: Switching to Frei marks the row untracked
- **GIVEN** a Gewicht row `{ name: "Salz", unit: "g", amount: 5 }`
- **WHEN** the user selects the **Frei** segment
- **THEN** the row becomes `untracked: true`, any `pieceQuantity` is cleared, and the Frei body (amount +
  free-text unit + the "Zählt nicht…" caption) is shown

#### Scenario: Frei with an empty unit label writes no displayQuantity
- **GIVEN** a Frei (untracked) row whose free-text unit input is empty after trim
- **THEN** no `displayQuantity` is written and the row renders its canonical `amount unit` muted

#### Scenario: Frei with a unit label writes displayQuantity
- **GIVEN** a Frei (untracked) row
- **WHEN** the user enters amount `1` and unit `"TL"`
- **THEN** the row carries `displayQuantity = { amount: 1, unitLabel: "TL" }` and renders `1 TL`

#### Scenario: Switching back to Gewicht clears piece and untracked
- **GIVEN** a Stück row `{ unit: "g", amount: 300, pieceQuantity: { amount: 2, unitLabel: "Zwiebel", gramsPerPiece: 150 } }`
- **WHEN** the user selects the **Gewicht** segment
- **THEN** `pieceQuantity` is cleared, `untracked` is `false`, and the row is a mass-only `300 g` row
  (the current `amount` preserved)

#### Scenario: Editing the piece count in Stück mode recomputes the mass
- **GIVEN** a Stück row `1 Stück (≈ 150 g)` with `gramsPerPiece = 150`
- **WHEN** the user changes the count to `2`
- **THEN** the row updates to `2 Stück (≈ 300 g)` and `amount` becomes `300`, and the per-row macro
  sub-line updates live

#### Scenario: Editing grams-per-piece in Stück mode recomputes the mass
- **GIVEN** a Stück row `1 Stück (≈ 150 g)`
- **WHEN** the user edits grams-per-piece to `200`
- **THEN** `amount` becomes `200` and the live readout reflects the new mass

#### Scenario: Stück disabled on a non-mass unit
- **GIVEN** a row whose `unit` is `tbsp`
- **THEN** the **Stück** segment is disabled and only **Gewicht** and **Frei** are selectable

#### Scenario: Only the active mode's inputs are shown
- **GIVEN** any ingredient row
- **THEN** the editor renders exactly the body for the active mode — the other two modes' inputs are not
  present in the DOM

### Requirement: Recipe detail and editor header back navigation
The Recipe Detail (read) view and the Recipe Editor SHALL present their back/close affordance as a single
**header back-arrow**: an arrow-only icon button (chevron-left) rendered inline to the **left of the
heading**, aligned to the content edge. This REPLACES the Recipe Detail's text `← Zurück` link and the
Recipe Editor's close `×` button. There MUST be no `×` close button in these headers.

On the Recipe Detail the back-arrow returns to the recipes list. On the Recipe Editor the back-arrow
invokes the cancel handler (discarding the in-progress edit, with the existing unsaved-changes guard if
any). The arrow MUST have an accessible label.

#### Scenario: Recipe detail back-arrow returns to the list
- **WHEN** the user opens a recipe in read mode and activates the header back-arrow
- **THEN** the recipes list is shown again

#### Scenario: Recipe editor back-arrow cancels
- **WHEN** the user is in the Recipe Editor and activates the header back-arrow
- **THEN** the editor's cancel handler runs (the same as the existing "Abbrechen" action) and no `×`
  close button is present in the header

## MODIFIED Requirements

### Requirement: Recipes UI — list and create
The frontend SHALL provide a Recipes screen, reachable from the bottom navigation, that lists all recipes
and exposes a "New recipe" affordance. The recipe form MUST allow entering `name`, `yield`, an ordered
list of ingredients (each via the same ingredient picker the log drawer uses), and an ordered list of
steps (free-text per step). Saving the form invokes the add-recipe command.

Each ingredient row's weight / piece / untracked behaviour is driven by the **measurement-mode control**
(see "Recipe form ingredient measurement-mode control"): the **Gewicht** mode holds the mass `amount`,
the **Stück** mode holds the `pieceQuantity` (count + piece-name + grams-per-piece, with editing the
count or grams-per-piece recomputing the mass `amount`), and the **Frei** mode holds the `untracked` flag
and the optional `displayQuantity`. Switching a Stück row to another mode clears its `pieceQuantity` (no
separate "detach" confirmation is needed — the mode switch is the explicit action).

The **initial mode** of a newly added row depends on the source picked in the ingredient picker:

- A FOODS result with `untracked: true` MUST initialize the new row in **Frei** mode (`untracked: true`).
- A FOODS result without an `untracked` flag (or with `untracked: false`) MUST initialize the new row in
  **Gewicht** mode (`untracked: false`).
- An OFF (Open Food Facts) result MUST initialize the new row in **Gewicht** mode (`untracked: false`).

The mode control on every row MUST allow the user to override the inherited or default mode at any time
before saving. Rows in **Frei** mode (`untracked: true`) MUST be visually distinguished from tracked rows
(muted styling and/or a small badge) so the recipe's macro story is scannable at a glance.

#### Scenario: Empty state
- **WHEN** the user opens the Recipes screen and no recipes exist
- **THEN** an empty state with a "New recipe" call-to-action is shown

#### Scenario: Create from screen
- **WHEN** the user fills the recipe form with a name, yield, at least one ingredient, and zero or more
  steps, then submits
- **THEN** the recipe is added, the form closes, and the recipe appears in the list

#### Scenario: Validation feedback
- **WHEN** the user attempts to save a recipe with a missing name or no ingredients
- **THEN** the form surfaces inline validation errors and does not submit

#### Scenario: Edit piece count recomputes weight
- **WHEN** an ingredient row is in Stück mode showing `1 Stück (≈ 150 g)` with `gramsPerPiece = 150` and
  the user changes the piece count to `2`
- **THEN** the row updates to `2 Stück (≈ 300 g)` and the underlying `amount` becomes `300`

#### Scenario: Edit grams-per-piece recomputes weight
- **WHEN** an ingredient row is in Stück mode showing `1 Stück (≈ 150 g)` and the user edits
  `gramsPerPiece` to `200`
- **THEN** the row updates to `1 Stück (≈ 200 g)` and the underlying `amount` becomes `200`

#### Scenario: Switching a piece row to weight drops the piece info
- **WHEN** an ingredient row is in Stück mode (`pieceQuantity` set) and the user selects the **Gewicht**
  segment
- **THEN** the row becomes a mass-only row with `pieceQuantity` cleared, keeping its current `amount`

#### Scenario: Picking a FOODS-untracked entry initializes the row in Frei mode
- **WHEN** the user picks a FOODS entry whose `untracked: true` (e.g. "Salz") in the recipe form's
  ingredient picker
- **THEN** the new ingredient row is rendered with the **Frei** segment active and visually muted

#### Scenario: Picking a tracked FOODS or OFF entry initializes the row in Gewicht mode
- **WHEN** the user picks a tracked FOODS entry (e.g. "Hähnchenbrust") or an OFF result in the recipe
  form's ingredient picker
- **THEN** the new ingredient row is rendered with the **Gewicht** segment active and the standard tracked
  styling

#### Scenario: User switches a tracked row to Frei in the form
- **WHEN** the user opens the recipe form, picks a tracked entry, and selects the **Frei** segment on its
  row
- **THEN** the row's `untracked` becomes `true` in form state and the row's visual treatment switches to
  muted

#### Scenario: User switches an inherited Frei row back to Gewicht in the form
- **WHEN** the user picks a FOODS-untracked entry and selects the **Gewicht** segment on its row
- **THEN** the row's `untracked` becomes `false` in form state and the row's visual treatment switches
  back to tracked styling

#### Scenario: Untracked flag persists on save
- **WHEN** the user saves a manually-authored recipe whose form contains both tracked (Gewicht/Stück) and
  Frei rows
- **THEN** the persisted recipe carries `untracked: true` on the Frei rows and `untracked: false` (or
  absent) on the rest

#### Scenario: Editing an existing recipe preserves and toggles mode
- **WHEN** the user opens an existing recipe in edit mode, where one row is Frei (`untracked: true`) and
  another is Gewicht, and switches the second row to Frei before saving
- **THEN** the update-recipe payload reflects both rows' final `untracked` values, and the persisted
  recipe carries them

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
- **GIVEN** the recipe form is open with an empty ingredient list and the hero shows `0 kcal · 0 P / 0 C / 0 F`
- **WHEN** the user adds an ingredient `{ amount: 100, macrosPerUnit: { calories: 2, protein: 0.2, carbs: 0, fat: 0 } }` to a recipe with `yield = 1`
- **THEN** the hero updates to `200 kcal · 20 P / 0 C / 0 F` per serving

#### Scenario: Totals update when an ingredient is switched to Frei
- **GIVEN** the form contains one tracked ingredient contributing 200 kcal per serving
- **WHEN** the user selects the **Frei** segment on that row
- **THEN** the hero updates to `0 kcal · 0 P / 0 C / 0 F` per serving (untracked rows are excluded)

#### Scenario: Totals update when an ingredient amount is edited
- **GIVEN** the form contains one tracked ingredient with `amount: 100` contributing 200 kcal per serving (yield 1)
- **WHEN** the user changes the amount to `150`
- **THEN** the hero updates to `300 kcal · 30 P / 0 C / 0 F` per serving

#### Scenario: Totals update when the servings stepper changes
- **GIVEN** the form contains a recipe with `total = 400 kcal` and `servings = 2`, showing `200 kcal` per serving
- **WHEN** the user increments the hero's servings stepper to `4`
- **THEN** the hero updates to `100 kcal` per serving (total unchanged) and the footer reads "Gesamt 400 kcal für 4 Portionen"

#### Scenario: Strip computation does not call the API
- **WHEN** the user interacts with any field in the recipe form
- **THEN** no request is sent to the backend solely to compute totals
