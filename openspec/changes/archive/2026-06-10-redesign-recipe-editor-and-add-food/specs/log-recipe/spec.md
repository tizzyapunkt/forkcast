## MODIFIED Requirements

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
