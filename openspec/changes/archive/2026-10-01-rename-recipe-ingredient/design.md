## Context

A `RecipeIngredient` is a snapshot (`name`, `unit`, `macrosPerUnit`, `amount`, optional
`pieceQuantity` / `untracked` / `displayQuantity` / `note`) with no food id or `source`. Logging a
recipe copies these snapshots into the meal log, and recents, favorites and the grocery list all key on
case-insensitive `name` + `unit`. In `recipe-ingredient-editor.tsx` the row's name is already a button
that opens the picker in replace mode, and the per-row note already uses an inline, borderless input.
The picker's `AmountStep` sits inside the recipe `<form>`, so it uses a `div` and handles Enter itself.

## Goals / Non-Goals

**Goals:** rename is a pure edit of the snapshot's `name`, done entirely in the frontend editor state
and saved through the existing `add-recipe` / `update-recipe` payloads.

**Non-Goals:** no new endpoint, no new persisted field, no change to how log entries, recents,
favorites or the grocery list identify a food.

## Decisions

**1. Overwrite the snapshot name instead of adding a `displayName` / alias field.**
A separate `displayName` beside the original OFF name would keep the shop name around, but every
consumer (log, recents, favorites, grocery list, recipe detail) would then have to choose which one to
show, and identity rules would get muddier. The original name has no downstream use: macros are
already copied, and the OFF id was never stored. Overwriting keeps one name everywhere.

**2. Rename instead of caching OFF products.**
A local OFF cache needs a store, invalidation and a "which source wins" rule in search. The problem
being solved is the *name*, and once a renamed row is logged, "Zuletzt verwendet" and favorites already
surface it under the clean name. If renaming the same product in several recipes gets tedious, the
next step is an explicit "Im Katalog speichern" from the amount step (reusing the catalog create
operation), not a cache.

**3. Rename on every editor row, name field in the amount step only for `OFF`/`SCAN`.**
After a pick, the row doesn't know its source, and adding `source` to the persisted shape just to gate a
harmless edit isn't worth it. At pick time the source *is* known, so the amount step only shows the
extra field where shelf names are the norm. Catalog picks stay one field, one tap.

**4. Separate rename affordance, name tap still replaces.**
The name button is the established replace entry point (with `↻`). Rename gets its own small icon
button (lucide `Pencil`, like the note line) next to the name. While renaming, the name button is swapped
for a borderless `<input>` in the same spot. Enter/blur commits, Escape cancels, and an empty value
restores the old name. The editor tracks `renamingIndex` in local state, the same way it tracks
`replacingIndex`. Enter calls `preventDefault` so the outer recipe form isn't submitted, matching
`AmountStep`.

**5. Backend: trim in `normalizeIngredient`.**
It already trims `note` on both write paths, and validation already rejects a whitespace-only name. No
max length is added, because existing recipes may hold long OFF names, and a limit would make them fail
on their next unrelated update.

## Risks / Trade-offs

- [The row's React key includes `ing.name`, so committing a rename remounts the row] → The commit
  happens on Enter/blur, after which the input is meant to close anyway. Note state (`openNotes`) is
  keyed by index and survives. Covered by an editor test.
- [The renamed name can collide with another food of the same unit, e.g. two different "Skyr"
  products] → They merge in recents and the grocery list, by design (same rule as today for identical
  names). The user picked the name, so the merge is wanted.
- [The original OFF name is lost after a rename] → Accepted (decision 1). The user can still replace the
  row via the picker to get the product back.

## Migration Plan

None. No data shape changes. Existing recipes load and save unchanged; trimming only affects names
that are saved again.
