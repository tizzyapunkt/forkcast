## Context

The planner is a weekly view over `LogEntry` (`GET /week-log/{startDate}`). A recipe batch is the set
of entries sharing `recipeBatchId` on one date. After `edit-planned-recipe-batches`, copied days get
their own batch ids, and swaps and extras stay inside their batch. Entries denormalise
`name`/`unit`/`macrosPerUnit` and carry no catalog id. `logRecipe` never writes untracked recipe
ingredients to the log. The catalog (`CatalogStore`) is in memory and read synchronously.

## Goals / Non-Goals

**Goals:**
- A pure, stateless query in its own bounded context (`shopping`), consistent with CQRS: a read model
  cutting across meal log, recipes and catalog.
- One new stored field (`cookedPortions`) and one small command in `meal-log`.
- A review sheet that is useful before any Bring! integration exists.

**Non-Goals:**
- Leftovers / batch cooking across days ("Reste", cooked portions of 0). The field allows adding it
  later as a value below the logged portions.
- A multiplier for ad-hoc entries or whole slots.
- Pantry / staples memory, pack sizes, aisle grouping, persisted lists.
- Unit conversion between g, ml and spoons. Identities with different units stay separate.

## Decisions

### Contributions are computed per source, then combined

`buildGroceryList(startDate)` loads the week's entries (`findAll` filtered to the date range, as
`getWeekLog` does), groups batch entries by `(date, recipeBatchId)`, and produces a flat list of
contributions `{ name, unit, amount, date, untracked }`:

```
 ad-hoc full entry ──────────────────────────► amount
 batch entry ────────────────────────────────► amount × cooked / recipePortions
 recipe.ingredients[untracked] (once/batch) ─► amount × cooked / recipe.yield
 quick entry ────────────────────────────────► skippedQuickEntries++
```

It then folds them by `ingredientIdentityKey(name, unit)`, reusing the meal-log rule so "same food"
means the same thing everywhere. The fold is a pure function tested on its own, and the use case test
covers the wiring.

*Alternative:* rebuild batches entirely from the recipe (scale all ingredients). Rejected: it would
ignore amount edits, swaps and extras made in the plan, which are exactly what the previous change made
possible.

### Batches grouped by date and id, even after the copy fix

Days copied before `edit-planned-recipe-batches` still share batch ids. Grouping by
`(date, recipeBatchId)` counts each day's batch, and its untracked tail, once, regardless of that
history.

### `cookedPortions` stored on each batch entry

This mirrors `recipePortions`, which is also per entry. Grouping, copying (spread) and batch removal
then work without a new store, and the grocery query reads it from any entry of the group.
`setCookedPortions` writes all entries of the group in one `update` per entry. Every entry is rewritten
with the same value, so a failure mid-way is repaired by retrying.

*Alternative:* a separate `batch-settings.json` keyed by `(date, recipeBatchId)`. Rejected: a second
store that copy and remove would have to keep in sync.

The minimum is `recipePortions` (not 1) because this change models "cooking more than I eat". Going
lower would mean leftovers, which is deferred.

### Untracked identity and the piece hint

An item is untracked only if **every** contribution is untracked. Olivenöl logged ad-hoc once plus
used untracked in a recipe is therefore a normal item. The piece hint looks the name up in the
catalog's folded name and synonyms. It only applies to `g` because piece sizes are in grams.

### HTTP and frontend

`GET /grocery-list/{startDate}` returns:

```
{ startDate, items: [{ name, unit, amount, untracked, dates: string[],
                       pieceHint?: { count, label } }],
  skippedQuickEntries }
```

The frontend adds `features/grocery-list/grocery-list-sheet.tsx` (a `BottomSheet`), opened from a
`ShoppingCart` button in the planner header. The query key is `groceryList(startDate)` with
`staleTime: 0`. The sheet mounts on open, so each open refetches and reflects the current plan without
wiring invalidation into every log mutation. Tick state is `useState<Set<string>>` of unticked identity keys.
Copy uses `navigator.clipboard.writeText`. Cooked-portions control: tapping the banner's portions text
opens a small stepper (`−` / value / `+`, step 1, minimum = logged portions), saved on confirm via
`useSetCookedPortions`.

## Risks / Trade-offs

- **Name-based identity**: "Hähnchenbrust" and "Hähnchenbrustfilet" become two items → acceptable,
  visible on review; the catalog already normalises names on most paths.
- **Untracked amounts look odd** ("Salz 5 g") → they are listed, not hidden, so the user decides. Pack
  sizes can come later.
- **Clipboard unavailable** (non-secure context) → the app runs over HTTPS through the tunnel. On failure,
  show an error banner instead of a false confirmation.
- **Per-entry writes in `setCookedPortions` aren't atomic** → idempotent, so retrying fixes it. If it
  shows up in practice, add an `updateMany` to the repository port.

## Migration Plan

`cookedPortions` is optional. Existing entries read as "cooked = logged". No data migration is needed.
Ship after `edit-planned-recipe-batches`.
