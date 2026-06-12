# weekly-meal-plan Specification

## Purpose
TBD - created by archiving change add-weekly-meal-plan. Update Purpose after archive.
## Requirements
### Requirement: Week-log read model
The system SHALL expose a query that returns a week of the meal log: given a `startDate` (ISO date), it
returns the **seven consecutive days** beginning at `startDate`, each shaped as the existing per-day
`DailyLog` (slots with their entries and per-day `DayTotals`), plus a **week aggregate** (the sum of the
seven days' totals) and **daily averages** (the week aggregate divided by 7). The per-day rollup MUST be
identical to the diary's (`getDailyLog`) so a day shows the same numbers in the planner and the diary.

The query MUST read the existing `LogEntry` store; it introduces no new persisted shape. Days with no
entries MUST appear as empty days (all slots present, zero totals) — never omitted — so the result always
has exactly seven days.

The system SHALL expose this read over HTTP as `GET /week-log/{startDate}` returning the week structure as
JSON.

#### Scenario: Returns seven consecutive days
- **WHEN** a client requests the week log for `startDate = "2026-06-08"` (a Monday)
- **THEN** the response contains exactly seven days for `2026-06-08` through `2026-06-14`, each with its
  four slots and per-day totals

#### Scenario: Per-day totals match the diary
- **GIVEN** a day with logged entries totalling `1846 kcal`
- **WHEN** that day appears in a week-log response
- **THEN** its `totals` equal the `getDailyLog` result for that date

#### Scenario: Empty days are present with zero totals
- **WHEN** a day in the requested week has no entries
- **THEN** that day is present in the response with all four slots empty and totals of zero

#### Scenario: Week aggregate and averages
- **WHEN** the week's seven days total `13_300 kcal`
- **THEN** the response's week aggregate is `13_300 kcal` and the daily average is `1900 kcal`
  (aggregate ÷ 7)

#### Scenario: HTTP endpoint
- **WHEN** a client sends `GET /week-log/2026-06-08`
- **THEN** the response is `200` with the seven-day week structure

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

### Requirement: Per-day and per-week rollups against goals
Each day section SHALL display the day's total calories and macros rolled up from its entries, shown
**against the user's nutrition goal** (e.g. `{kcal} / {goal} kcal`), tinted with a **Neutral** tone scale
(empty → neutral; near goal → success; well over → a muted warning; otherwise accent) — the loud
`Alarm-Rot` deficit tone MUST NOT be used. The planner header SHALL display week-level rollups: the
**average kcal per day** (`Ø kcal/Tag`), the **average macros per day** (`Ø Makros / Tag`), and the count
of **planned days** (`{n}/7 Tage geplant`) where a planned day is any day with at least one entry.

#### Scenario: Day shows totals against the goal
- **GIVEN** a nutrition goal of `2919 kcal` and a day totalling `1846 kcal`
- **WHEN** the planner renders that day
- **THEN** the day section shows `1846 / 2919 kcal` (or equivalent) tinted with the Neutral tone

#### Scenario: Empty day indicated
- **WHEN** a day has no entries
- **THEN** its section shows an empty indicator (e.g. "leer") rather than a macro line

#### Scenario: Week averages in the header
- **GIVEN** the seven days average `1900 kcal/Tag`
- **WHEN** the planner renders
- **THEN** the header shows `Ø 1900 kcal/Tag` and the average macros per day

#### Scenario: Planned-days count
- **GIVEN** four of the seven days have at least one entry
- **WHEN** the planner renders
- **THEN** the header shows `4/7 Tage geplant`

#### Scenario: Alarm-Rot tone is not used
- **WHEN** a day's total is below the goal (a deficit)
- **THEN** the day is shown in the Neutral tone, never the ruled-out Alarm-Rot red

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

### Requirement: Copy a planned day to the next day
The planner SHALL let the user **copy a day's planned meals onto the following day**. The action MUST be
confirmed before it runs. On confirm, the system clones every `LogEntry` of the source day onto the next
day — each clone receives a fresh `id` and `loggedAt` and the next day's `date`, with its `slot` and
`ingredient` preserved. The copy is **additive**: it adds to whatever the target day already contains and
does not clear it first; the confirm dialog states this. The clone MUST be atomic (all entries copied or
none).

The system SHALL expose this as a command `copyLogDay(fromDate, toDate)` over HTTP as
`POST /copy-log-day { fromDate, toDate }`.

#### Scenario: Copy a day's meals to the next day
- **GIVEN** Monday has three entries and Tuesday is empty
- **WHEN** the user invokes "Tag kopieren" on Monday and confirms
- **THEN** Tuesday gains three new entries (fresh ids, `date` = Tuesday) mirroring Monday's slots and
  ingredients, and Monday is unchanged

#### Scenario: Copy is additive
- **GIVEN** Tuesday already has one entry
- **WHEN** the user copies Monday's three entries onto Tuesday
- **THEN** Tuesday has four entries (the existing one plus the three copies)

#### Scenario: Confirm required
- **WHEN** the user taps "Tag kopieren" but cancels the confirm
- **THEN** no entries are copied

#### Scenario: Atomic copy
- **WHEN** `copyLogDay` runs
- **THEN** either every source entry is cloned onto the target day or none is — no partial copy

#### Scenario: HTTP endpoint
- **WHEN** a client sends `POST /copy-log-day` with `{ fromDate, toDate }`
- **THEN** the response indicates success and the cloned entries are persisted on `toDate`

