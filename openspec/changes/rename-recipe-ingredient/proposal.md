## Why

Open Food Facts (and scanned) products come with names written for a shop shelf, not for a recipe:
"Skyr Natur 0,2% Fett - Arla - 450 g", "Bio Haferflocken Zartblatt". Today the only way to get a clean
"Skyr" into a recipe is to create a brand-new catalog food with copied macros, which is exactly the
kind of friction forkcast exists to remove. A recipe ingredient is already a self-contained snapshot
(`name`, `unit`, `macrosPerUnit`, …) with no link back to the food it came from, so its name can simply
be overwritten in place. No new food is needed.

## What Changes

- **Rename a recipe ingredient in the editor**: every ingredient row in the recipe editor (new recipe,
  edit recipe, AI-import review) gets a small "Name ändern" (pencil) affordance. Tapping it turns the
  row's name into an inline text field. Enter or blur commits the new name, Escape cancels, and an empty
  value restores the previous name. Only the row's `name` changes; macros, unit, amount, piece
  quantity, untracked flag and note are kept. Tapping the name itself still opens "replace via picker",
  as it does today.
- **Name the product while adding it**: when the user adds an `OFF` or `SCAN` search result to a
  recipe, the picker's amount step also shows a name field ("Name im Rezept"), pre-filled with the
  product name. Leaving it as is costs nothing; editing it stores the shorter name on the new row.
  Catalog results don't show this field, since their names are already curated.
- **Backend trims the ingredient name** on `add-recipe` / `update-recipe` (like `note`), so a renamed
  row never persists stray whitespace. Validation is otherwise unchanged: the name must stay non-empty.
- **Knock-on effect, no extra work**: because logged recipe entries copy the row's name, a renamed
  product shows up under its clean name in the daily log, "Zuletzt verwendet", favorites (once starred)
  and the grocery list. That covers most of the "find it faster later" wish without a cache.

### Non-goals

- **No Open Food Facts cache / local OFF copy.** Recents and favorites already make a used product
  quick to find again under the clean name. A cache would add a store, invalidation and a sync story
  for little gain.
- **No "adopt into catalog" action** (turning an OFF product into a catalog entry with the custom
  name). It's a sensible follow-up if renaming per recipe turns out to be too repetitive. The catalog's
  create flow already exists for that today.
- No rename in the log drawer's ad-hoc logging flow.
- No tracking of where a row came from (`source`) on recipe ingredients. Renaming is allowed on every
  row because it's harmless for catalog rows too.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `recipes`: the ingredient name is persisted trimmed. New requirement for renaming an ingredient row
  inline in the recipe editor, and for naming an `OFF`/`SCAN` product in the picker's amount step.

## Impact

- Frontend: `features/recipes/recipe-ingredient-editor.tsx` (rename affordance + inline input),
  `features/recipes/recipe-ingredient-picker.tsx` (`AmountStep` name field for `OFF`/`SCAN`),
  `i18n/de.ts` (copy), and the matching tests.
- Backend: `domain/recipes/normalize-ingredient.ts` (trim `name`) plus use-case tests. No API shape
  change, no new endpoint, no data migration. Existing recipes load unchanged.
