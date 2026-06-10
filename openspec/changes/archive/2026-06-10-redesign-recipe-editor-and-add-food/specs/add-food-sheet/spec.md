## ADDED Requirements

### Requirement: Add-food sheet shell and tabs
The frontend SHALL provide an **add-food bottom sheet** (`LogIngredientDrawer`), opened from the "+" on a
meal slot, for adding an entry to a given `date` + `slot`. The sheet MUST be a bottom sheet: it slides up
over a dim backdrop, has rounded top corners and a drag handle, and is constrained to a maximum height so
it does not cover the whole viewport.

The sheet header MUST show the title `"Zu {Mahlzeit} hinzufügen"` (the meal-slot label) and a text
**"Abbrechen"** action on the right that closes the sheet. At the **root** (no sub-step open) the sheet
body MUST show a segmented **tab bar** — Suche / Zuletzt / Rezepte / Schnell (Search / Recent / Recipes /
Quick) — over the body for the active tab (search results, recently-used list, recipe list, manual
quick-add form). The default tab on open is Search.

The detailed contents of the Recent tab, the Search tab and its source toggle, and the Quick form are
governed by their existing capabilities (`recently-used-ingredients`, `ingredient-search-source-toggle` /
`curated-foods-source`, and the meal-log quick-add). This capability owns the sheet **shell** (header,
tabs, sub-step swapping) only.

#### Scenario: Sheet opens at the root with tabs
- **WHEN** the user taps "+" on a meal slot
- **THEN** the sheet slides up showing the title "Zu {Mahlzeit} hinzufügen", an "Abbrechen" action, and
  the tab bar with Search selected

#### Scenario: Cancel closes the sheet
- **WHEN** the user taps "Abbrechen"
- **THEN** the sheet slides out and closes without adding an entry

### Requirement: Add-food sheet catalog-food sub-step (AmountStep)
When the user picks a catalog food (from Search or Recent), the sheet SHALL swap to an **AmountStep**
sub-step rendered at the sheet level (not inside a tab). The AmountStep MUST show:

- the food name and its per-100 macro line,
- a **Menge** number input (pre-filled per the `ingredient-serving-size` rules when applicable),
- quick-amount chips (25 / 50 / 100 / 150 / 200),
- a live summary card showing the kcal + macros for the chosen amount, and
- a primary button labelled **"{n} {unit} erfassen"** that logs the entry for the sheet's `date` + `slot`
  and closes the sheet.

The macro math is `macrosPerUnit × amount` as today; the AmountStep changes presentation only, not how an
entry is computed or persisted.

#### Scenario: Picking a catalog food opens the AmountStep
- **WHEN** the user picks a catalog food from the Search or Recent tab
- **THEN** the sheet shows the AmountStep with the food name, per-100 line, a Menge input, the quick-amount
  chips, and a live summary

#### Scenario: Quick-amount chip sets the amount
- **WHEN** the user taps the `150` chip on the AmountStep
- **THEN** the Menge input becomes `150` and the summary card recomputes to the kcal/macros for 150 of the
  unit

#### Scenario: Confirm logs the entry and closes
- **WHEN** the user confirms with "{n} {unit} erfassen"
- **THEN** an entry is logged for the sheet's `date` + `slot` and the sheet closes

### Requirement: Add-food sheet sub-step navigation and tab-bar hiding
Entering any sub-step (the catalog-food AmountStep or the recipe RecipePortionStep) MUST **hide the tab
bar** — the tabs and their bodies render only at the root. The sheet title persists across sub-steps. On a
sub-step the header MUST surface a **back-arrow** (chevron-left) inline to the **left of the title** (the
same header-arrow pattern used on Recipe Detail/Editor); there MUST be no separate footer "Zurück" button.

Activating the header back-arrow MUST clear the current sub-step, returning to the originating tab (e.g.
back from RecipePortionStep returns to the Recipes tab, not Search) **and restoring the tab bar**.
Closing or cancelling the sheet MUST reset the sub-step state after the slide-out completes (~300 ms), so
the next open starts at the root.

#### Scenario: Tab bar hidden on a sub-step
- **WHEN** the sheet is on the AmountStep or the RecipePortionStep
- **THEN** the tab bar is not shown and a header back-arrow is present to the left of the title

#### Scenario: Back-arrow restores the tab bar and the originating tab
- **WHEN** the user is on the RecipePortionStep (reached from the Recipes tab) and activates the header
  back-arrow
- **THEN** the sheet returns to the Recipes tab and the tab bar is shown again

#### Scenario: Title persists across the sub-step
- **WHEN** the user moves from the root into a sub-step
- **THEN** the header title still reads "Zu {Mahlzeit} hinzufügen"

#### Scenario: Closing resets the sub-step
- **WHEN** the user is on a sub-step and closes the sheet (Abbrechen or backdrop), then reopens it
- **THEN** the sheet opens at the root tab view, not the previous sub-step
