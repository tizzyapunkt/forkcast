## Context

A recipe batch is not an entity — it is the set of `LogEntry` rows sharing a `recipeBatchId`
(`domain/meal-log/types.ts`). Grouping happens purely at render time in the shared `EntryList`
(`features/daily-log/entry-list.tsx`), which both the daily log and the planner use. So "an entry is in a
batch" means exactly "it carries the batch's `recipeBatchId`" (plus, for display, `recipeId` and
`recipePortions`).

Today the only write paths into the log are `logIngredient` (ad-hoc, no batch fields), `logRecipe`
(creates a new batch), `editLogEntry` (amount/quick macros only) and `copyLogDay`. None can put a food
into an *existing* batch.

`copyLogDay` spreads the source entry, so a copied day's entries keep the **same** `recipeBatchId` as
the source day, and `removeRecipeLog` matches by `recipeBatchId` across all dates. Removing a copied
batch therefore also removes the source day's batch. Stored data may already contain such shared ids.

## Goals / Non-Goals

**Goals:**
- Two commands that write into an existing batch, reusing the existing repository port as-is.
- One UI entry point per action in `EntryList`, so the diary and planner get it from the same code.
- Reuse the add-food sheet and its amount step rather than building a second picker.

**Non-Goals:**
- Marking a row as "swapped" or "added" (no provenance field). Nothing needs to read it yet.
- Updating the recipe from a planned change ("auch im Rezept speichern").
- Replacing/adding quick entries or whole recipes inside a batch.
- Converting an existing loose ad-hoc row into a batch member (drag into group).
- Repairing stored data that already shares batch ids across dates (date-scoped removal makes it
  harmless; see Decisions).

## Decisions

### Two dedicated commands instead of widening `editLogEntry`

`editLogEntry` is an amount/macros edit keyed by ingredient type; a food swap changes the entry's
identity (name/unit/macros) and has batch-specific preconditions. A separate `replaceBatchIngredient`
keeps each command's intent readable and its validation local. `addToRecipeBatch` is also separate from
`logIngredient`, because it derives `slot`, `recipeId` and `recipePortions` from the batch instead of
trusting the client, so a stale client cannot place an entry into a batch under a mismatched slot.

*Alternative:* a generic `PATCH /log-entry/:id` accepting any field. Rejected: turns the API into CRUD
and would let a client set batch fields freely.

### Replace keeps `id`, refreshes `loggedAt`

Keeping `id` makes it an in-place edit (open inline-amount inputs and React keys stay stable).
Refreshing `loggedAt` makes the replacement food surface in Zuletzt via the existing
`latestFullEntryByIdentity` rule, with no change to the recently-used query. The trade-off is that the
entry's "logged at" no longer reflects the original recipe log — nothing reads it for that purpose.

### Batch scoped by `(date, recipeBatchId)` for add

`addToRecipeBatch` looks up the batch with `findByDate(date)` filtered by `recipeBatchId`. That is
cheaper than `findAll`, and it's correct under copied days, where the same id exists on several dates.
Replace needs no date because it targets one entry by id.

### Batch-targeted mode on the existing add-food sheet

`LogIngredientDrawer` gets an optional `target` prop:

```
target?: { kind: 'replace'; entry: LogEntry; recipeName: string }
       | { kind: 'add'; recipeBatchId: string; date: string; recipeName: string }
```

When `target` is present, the drawer hides the Rezepte and Schnell tabs, uses the action + recipe name as
its title, and passes a submit override to `FullEntryConfirm`. `FullEntryConfirm` today calls
`useLogIngredient` itself; it gains an optional `onSubmitIngredient(ingredient)` callback so the drawer
can route the confirmed full ingredient to the replace/add mutation. Without the prop it behaves exactly
as now.

For replace, the drawer passes `defaultAmount = entry.ingredient.amount` into the confirm step when the
picked result's unit equals the entry's unit. Otherwise it passes what the tab would have passed anyway.

*Alternative:* a dedicated "ingredient picker" sheet like the recipe editor's `recipeIngredientPicker`.
Rejected: the add-food sheet already has search, favorites, recents, untracked-disabling and the amount
step. A second picker would drift from it.

### Affordance placement

- Replace: a small icon button (`ArrowLeftRight`, `iconSm`, quiet variant) on `EntryRow`, rendered only
  when `EntryList` passes it an `onReplace` handler, which it does only for rows inside a `BatchGroup`. The
  row stays free of batch knowledge.
- Add: a `Plus` icon button on the `BatchGroup` banner, left of the existing remove button.
- `BatchGroup` owns the drawer state (`target`), because it already knows the recipe name and batch id.

### Mutations and cache

Two hooks, `useReplaceBatchIngredient` and `useAddToRecipeBatch`, mirror `useRemoveRecipeLog`'s
invalidation: `dailyLog(date)`, `weekLogAll()`, `recentlyUsedIngredients()`, `favoriteIngredients()`.

### Copy mints one fresh batch id per source batch

`copyLogDay` builds a `Map<oldBatchId, newBatchId>` while cloning, so every clone of one source batch gets
the same new id. Each copied batch then stays a single group, independent of its source. `recipeId`
and `recipePortions` are kept, and entries without a batch id stay without one.

*Alternative:* leave the ids shared and treat `(date, recipeBatchId)` as the identity everywhere.
Rejected as the only fix: every future batch-keyed feature (the grocery list's per-batch "gekocht")
would need to remember the date qualifier.

### Batch removal is scoped to a date anyway

`removeRecipeLog(recipeBatchId, date)` looks up with `findByDate(date)`. With fresh ids on copy this
doesn't change anything for new data. For days copied before this change, it removes only the batch
the user tapped, so the stored data needs no migration script. `date` becomes required in the
`/remove-recipe-log` body. The frontend mutation already receives it, so only `api/remove-recipe-log.ts`
changes.

## Risks / Trade-offs

- **Legacy shared batch ids stay in the data** → harmless for display, removal and add, which are all
  date-scoped. The grocery list must scope by `(date, recipeBatchId)` too, or accept that pre-fix copies
  share per-batch settings. Noted for that change.
- **`/remove-recipe-log` now requires `date`** → the frontend and backend ship together from one repo and
  one deploy, so there's no client left sending the old body.
- **Unit change on replace** (e.g. g → ml food): the amount step re-asks instead of converting →
  acceptable, it's one number and the user is already in the flow.
- **Row gets a third control on narrow screens** (amount input, replace, remove) → icon-only `iconSm`
  button, same footprint as remove. The 375 px smoke test showed the row overflowing the batch card by
  42 px, so `EntryRow` now lets its kcal and macro text wrap onto two right-aligned lines when space runs
  out. Rows that fit render unchanged.

## Migration Plan

No persisted shape changes; existing entries and batches work unchanged. Rollback is reverting the
code.
