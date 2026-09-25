## Why

Planning a week ahead works, but turning that plan into a shopping trip is still manual: reading every
day's slots and adding up what to buy. On top of that, the meal log records what *I* eat, not what goes in
the pot. A Chili logged at 1 portion but cooked for two, or the salt and spices that recipes deliberately
leave out of the log, never make it onto a list built from the log alone.

## What Changes

- New read model **grocery list for a week**: given the planner's `startDate`, it adds up everything
  the seven days need and returns one line per food, with a total amount, a piece hint where the catalog
  knows piece sizes ("380 g · ≈ 3 Stück"), and the weekdays that need it.
  - ad-hoc full entries count 1:1
  - recipe batches count at their **cooked** portions (see below), including entries replaced or added
    in the batch (from `edit-planned-recipe-batches`)
  - the recipe's **untracked** ingredients (Salz, Gewürze, …), which are never logged, are pulled from
    the recipe and listed in a separate trailing section
  - quick entries can't be bought and are left out; the list says how many were skipped
- New per-batch value **gekocht (cooked portions)**: on each recipe batch, how many portions are cooked,
  separate from how many are logged as eaten. It defaults to the logged portions and can only be set
  equal or higher. It affects the grocery list only, never nutrition totals. It's set from the batch
  banner in both the daily log and the planner.
- New planner action **Einkaufsliste**: opens a sheet for the week being viewed, with every line checked.
  The user unticks what's already at home and copies the checked lines as plain text. Nothing is stored:
  the list is rebuilt every time it's opened.
- Sending the list to Bring! is **not** part of this change (see `send-grocery-list-to-bring`).

## Capabilities

### New Capabilities

- `grocery-list`: the weekly grocery-list read model, its HTTP endpoint, and the planner's Einkaufsliste
  sheet (review, untick, copy).

### Modified Capabilities

- `log-recipe`: recipe batches gain a cooked-portions value, with a command to set it and a banner
  control in the daily log and planner.

## Impact

- **Backend**: new bounded context `domain/shopping/` (grocery-list query reading `LogEntryRepository`,
  `RecipeRepository`, `CatalogStore`); `domain/meal-log` gains the optional `cookedPortions` field on
  `LogEntry` and a `setCookedPortions` command; `addToRecipeBatch` copies `cookedPortions` onto the
  entries it creates.
- **HTTP**: `GET /grocery-list/{startDate}`, `POST /set-cooked-portions`.
- **Frontend**: new `features/grocery-list/` sheet opened from the planner header; banner control in
  `features/daily-log/entry-list.tsx`; clipboard copy.
- **Depends on** `edit-planned-recipe-batches`: swaps and extras must be inside the batch to scale with
  it, and copied days need their own batch ids.
