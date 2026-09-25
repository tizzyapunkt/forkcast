## Why

A logged recipe batch is the unit a meal is planned, displayed and removed as — but the only way to
change *what is in it* today is to remove a row and log a new food via "+", which lands as a loose
ad-hoc entry outside the batch. The meal silently falls apart: "Chili mit Tofu statt Hackfleisch"
becomes a Chili group plus a stray Tofu row. This matters now because the upcoming grocery list scales
each batch by how many portions are cooked; anything that has drifted out of its batch would not scale
with it and would quietly be under-bought.

## What Changes

- New command **replace an ingredient in a logged recipe batch**: swaps one entry's food (name, unit,
  macros per unit, amount) while the entry stays in its batch — `recipeId`, `recipeBatchId`,
  `recipePortions`, `date` and `slot` are preserved. The recipe definition is not touched.
- New command **add an ingredient to a logged recipe batch**: creates a new entry that joins an existing
  batch — same `recipeId`, `recipeBatchId`, `recipePortions`, `date` and `slot`.
- Both commands accept only **full** (catalog-style) ingredients and only target entries/batches that
  carry a `recipeBatchId`; ad-hoc and legacy (pre-batch) entries keep the existing flows.
- UI in the shared `EntryList`, so the **daily log and the planner both get it**:
  - each row inside a batch group gets a **replace** affordance ("Zutat ersetzen")
  - each batch banner gets an **add** affordance ("Zutat hinzufügen")
  - both open the existing add-food sheet in a batch-targeted mode, limited to Search, Favoriten and
    Zuletzt (no Rezepte, no Schnell), with the title naming the recipe; untracked foods stay un-loggable
    as in the normal log flow
  - replace pre-fills the amount step with the replaced entry's amount when the units match
- **Fix: copying a day keeps its batches separate.** "Tag kopieren" today clones entries with the
  source's `recipeBatchId`, so removing a batch on the copy also deletes it on the source day. Copying
  now gives each copied batch a fresh `recipeBatchId` (shared by that batch's clones), and removing a
  batch only deletes that batch's entries on the given date — which also covers days already copied
  before the fix.
- Existing behavior unchanged: inline amount edit, per-entry remove, batch remove, grouping, legacy
  per-row hints.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `log-recipe`: adds requirements for replacing an ingredient in and adding an ingredient to a logged
  recipe batch (commands, HTTP endpoints, and the batch-scoped add-food sheet mode), and extends
  "Editing recipe-sourced entries leaves the link intact" so a replace keeps the batch link; scopes
  "Remove a recipe-log batch atomically" to one date.
- `weekly-meal-plan`: "Copy a planned day to the next day" gives each copied recipe batch a fresh
  batch id.

## Impact

- **Backend** `domain/meal-log`: two new use cases (`replace-batch-ingredient`, `add-to-recipe-batch`);
  no new persisted shape, no repository port change (`findById`, `findByDate`, `update`, `save`
  suffice).
- **Backend** `copy-log-day` and `remove-recipe-log` use cases: fresh batch ids on copy, date-scoped
  batch removal.
- **HTTP**: `POST /replace-batch-ingredient`, `POST /add-to-recipe-batch`, wired in the app next to
  `/log-recipe` and `/remove-recipe-log`. `POST /remove-recipe-log` now requires `date` in its body
  (the frontend already has it; only the client call changes).
- **Frontend**: `features/daily-log/entry-list.tsx` + `entry-row.tsx` (affordances),
  `features/log-ingredient/log-ingredient-drawer.tsx` (batch-targeted mode), two new React Query
  mutations invalidating the daily-log, week-log and recently-used queries; `i18n/de.ts` copy.
- **Follow-up**: unblocks the grocery-list change, which relies on "everything in the pot is in the
  batch".
