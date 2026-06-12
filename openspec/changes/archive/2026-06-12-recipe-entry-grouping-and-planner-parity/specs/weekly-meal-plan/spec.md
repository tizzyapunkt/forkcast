# weekly-meal-plan — delta

## MODIFIED Requirements

### Requirement: Weekly planner view

The frontend SHALL provide a **Planner screen**, reachable from the bottom navigation, that renders the
active week in the `Liste` layout: the seven days as a vertical **accordion** of day sections (one day
expanded at a time). A collapsed day section MUST show the weekday + date, the day's total kcal against
the goal, a macro summary (or an empty indicator), and a progress bar; expanding a day reveals its four
meal slots and their entries. The planner reads the same meal-log data as the diary (via the week-log
read model).

An expanded day's slot MUST present its entries with the **same presentation as the daily log**: each
entry shows its name, its amount, its kcal value, and its macro suffix (per the `meal-log-display`
formats), and recipe-sourced batches render grouped with their banner (per the `log-recipe` grouped
display requirement). The planner MUST NOT use a reduced name-only rendering for entries.

The screen MUST provide **week navigation** (previous / next week) that moves the active week by seven
days and refetches. The week is Monday-based (Mo–So).

#### Scenario: Planner shows the active week as an accordion

- **WHEN** the user opens the Planner screen
- **THEN** the seven days of the active week are listed, with one day expanded and the others collapsed

#### Scenario: Expanding a day reveals its slots

- **WHEN** the user expands a day section
- **THEN** the day's four meal slots (Frühstück / Mittagessen / Abendessen / Snack) and their entries are
  shown, and any previously expanded day collapses

#### Scenario: Planner entries match the diary's presentation

- **GIVEN** a day whose lunch contains an ad-hoc entry (Haferflocken, 60 g) and a 2-entry recipe batch
- **WHEN** the user expands that day in the planner
- **THEN** Haferflocken renders with its amount, kcal, and macro suffix exactly as the daily log renders
  it, and the batch renders as a group card with banner — not as name-only rows

#### Scenario: Week navigation

- **WHEN** the user taps "next week"
- **THEN** the planner advances the active week by seven days and renders that week's data

#### Scenario: Planner reflects diary data

- **GIVEN** a day already has entries logged via the diary
- **WHEN** the user opens the planner on the week containing that day
- **THEN** that day's section shows those entries and their totals

### Requirement: Add and remove planned meals on a day

Each day/slot in the planner SHALL expose an **add ("+")** affordance that opens the existing **add-food
sheet** targeting that day's `date` and the chosen `slot`. Adding an entry MUST create `LogEntry`(s) on
that date through the same log flow the diary uses (catalog food, recipe-by-portions, recent, or quick) —
there is no separate planner write path. Each entry in a day/slot MUST expose a **remove** affordance that
deletes that one entry, and each recipe-log batch MUST expose the **batch remove** affordance on its group
banner (per the `log-recipe` batch-removal requirement). Because the planner and diary share the same
data, an add or remove in the planner MUST be reflected in the diary for that date (and vice versa)
without a manual refresh.

Full entries in a planner slot MUST additionally support **inline amount editing** with the same
semantics as the daily log (`meal-log-display`: immediate recompute of the row's displayed kcal/macros
from the typed value, debounced persistence, fallback to the persisted amount on empty/invalid input).
The day's and week's rollups MUST reflect the persisted change.

#### Scenario: Add a meal to a planned day

- **WHEN** the user taps "+" on a day's slot and logs a catalog food
- **THEN** a `LogEntry` is created for that day's `date` and `slot`, and the day's section updates to
  include it

#### Scenario: Add a recipe by portions to a planned day

- **WHEN** the user taps "+" on a day's slot, picks a recipe, and confirms portions
- **THEN** the recipe is logged into that day via the existing log-recipe flow

#### Scenario: Remove a planned entry

- **WHEN** the user removes an entry from a day's slot in the planner
- **THEN** that `LogEntry` is deleted and the day's totals update; other entries are unaffected

#### Scenario: Remove a planned recipe batch

- **GIVEN** a planner day whose dinner contains a recipe batch and an ad-hoc entry
- **WHEN** the user activates the batch's group-remove affordance
- **THEN** all entries of the batch are deleted, the ad-hoc entry remains, and the day's totals update

#### Scenario: Edit an amount inline in the planner

- **GIVEN** a planner day with a full entry of 100 g
- **WHEN** the user edits the entry's amount to 250 in the planner
- **THEN** the row's kcal/macros update immediately, the change persists via the same flow the diary
  uses, and the day's totals reflect the new amount

#### Scenario: Planner and diary stay in sync

- **WHEN** the user adds a meal to a future day in the planner and then opens the diary on that date
- **THEN** the diary shows the same entry (the two views read the same data)
