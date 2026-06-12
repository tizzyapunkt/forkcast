# Proposal: recipe-entry-grouping-and-planner-parity

## Why

Handoff 2 (`design_handoff_forkcast_2/`) changes how logged recipes look and how the weekly plan
relates to the diary: recipe-sourced entries render as a **grouped card** (book icon + recipe name +
portion count + a one-tap group remove) containing individually editable ingredient rows, and the
planner's expanded day slots look and behave **exactly like the diary's** (full entry rows, inline
amount editing, per-entry kcal/macros) instead of today's bare name + × chips. Today the app renders
recipe-sourced diary entries as flat rows with a per-row "AUS {REZEPT}" caption, the planner shows
name-only rows with no amounts or editing, and the recipe portion step announces ingredients it then
silently does not log (it lists untracked ingredients although `LogRecipe` skips them).

## What Changes

- **Recipe-log batch metadata**: `LogEntry` gains optional `recipeBatchId` (fresh per `LogRecipe`
  invocation) and `recipePortions` (the portion count chosen at log time) alongside the existing
  `recipeId`. Legacy entries without these fields keep loading and rendering as today.
- **Grouped recipe display (diary + planner)**: entries sharing a `recipeBatchId` render inside one
  group card — banner with book icon, the recipe's current name (resolved live via `recipeId`, per
  the existing hint requirement), the logged portion count ("N Port."), and a group-remove
  affordance. Rows inside stay individually editable/removable. The per-row "AUS {REZEPT}" hint
  remains only as the fallback for legacy entries without batch metadata.
- **Remove a whole recipe log atomically**: a new command + endpoint deletes all entries of one
  batch in a single atomic write (mirroring `LogRecipe`'s atomic insert).
- **Honest portion step**: the RecipePortionStep lists exactly the **tracked** ingredients that will
  be logged with their scaled amounts (today it wrongly lists untracked ones too — `LogRecipe`'s
  skip behavior is unchanged, per the 2026-06-11 decision), explains that each ingredient lands as
  an individually adjustable entry, and confirms with "Zutaten übernehmen".
- **Planner parity** (the design's "plan looks like the diary" rule): the planner's expanded day
  slots render entries with the same presentation as the daily log (name, editable amount, kcal +
  macro suffix, recipe grouping) and support the same inline amount editing and removal flows.

Out of scope: changing `LogRecipe`'s untracked-skip behavior (decided 2026-06-11: keep skipping);
purely visual planner polish (day-card date, TAG GESAMT block, header styling — see
`ui-polish-backlog.md` and the `unify-screen-headers-and-display-format` change).

## Capabilities

### New Capabilities

None — all changes extend existing capabilities.

### Modified Capabilities

- `log-recipe`: `LogEntry` batch metadata (`recipeBatchId`, `recipePortions`); grouped display
  replaces the per-row hint for batch-carrying entries; atomic batch removal (command + endpoint);
  portion-step content lists tracked-only ingredients and confirms with "Zutaten übernehmen".
- `weekly-meal-plan`: expanded day slots display entries with daily-log parity (same row
  presentation incl. grouping) and gain inline amount editing; remove flows match the diary
  (per-entry and per-batch).

## Impact

- **Backend**: `LogEntry` schema gains two optional fields; `LogRecipe` stamps them; new
  remove-recipe-log command + HTTP endpoint; JSON-store persistence unchanged otherwise (optional
  fields, no migration — legacy entries simply lack them).
- **Frontend**: shared entry-list component (grouped + flat rendering) used by both the daily log
  and the planner; planner slot bodies rewired to it; portion-step copy and confirm button; React
  Query mutations for batch removal and planner-side amount PATCH.
- Existing tests for the planner slot rendering and the portion step will change; `log-recipe`
  command/endpoint tests extend for the new fields and the batch-removal path.
