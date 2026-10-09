# Proposal

## Why

Meal prep happens once, for several planned meals and often for people eating along, but the app only
knows one recipe batch per day. Changing an ingredient while cooking means editing every planned
instance of that meal one by one, and amounts for the whole pot have to be worked out by hand. The
per-batch "cooked portions" value added for the grocery list has the same problem: it has to be set on
every batch, although the decision is made once per recipe and week.

## What Changes

- **New cooking view**, opened from a recipe batch in the planner. It covers one recipe in the planner's
  week: the user picks which planned instances (batches) of that recipe this cooking session covers and
  how many extra, unlogged portions are cooked for people eating along. It shows the whole pot: every
  ingredient scaled to all portions, in the recipe's order and units (tablespoons, pieces), its notes and
  steps, untracked ingredients, and the macros per portion.
- **Adjust while cooking:** change an ingredient's pot amount, swap it, add one or leave one out. Each
  edit is written back to the selected batches only, split by portion (every selected batch gets the same
  per-portion amount × its logged portions), in one atomic write. Each changed row has its own undo,
  which restores that row as it was when the session started. Undo is not kept across a reload.
- The cooking view keeps the screen on (Screen Wake Lock) while it is open, and its selection survives a
  reload through the URL. Nothing about the session is stored on the server.
- **Grocery list asks for portions per recipe.** Each recipe planned in the week gets a portions input,
  defaulting to the portions logged for it that week. Batch entries and untracked ingredients scale to
  that number. The input is sent with the query and is not stored. "An Bring! senden" carries it in the
  import token.
- **BREAKING:** `cookedPortions` on `LogEntry`, the `SetCookedPortions` command, `POST /set-cooked-portions`
  and the cooked-portions control on the batch banner are removed. Stored values are ignored.

Out of scope: saving changes back to the recipe, sessions spanning two weeks, sharing the portion
count between grocery list and cooking view, persisting undo.

## Capabilities

### New Capabilities

- `cooking-session`: cooking one planned recipe for a chosen set of its batches in a week, with extra
  portions, pot-level amounts and macros per portion, and edits written back to those batches by portion.

### Modified Capabilities

- `log-recipe`: the "Cooked portions of a recipe batch" requirement is removed.
- `grocery-list`: the list takes portions per recipe as input instead of reading cooked portions from
  batches; the Einkaufsliste sheet gets a portions input per recipe.
- `bring-import`: the import token and page carry the portions per recipe chosen in the sheet.

## Impact

- **Backend:** `meal-log` (new command and endpoint for setting ingredients across batches, an atomic
  multi-entry write on `LogEntryRepository`, removal of `setCookedPortions` and the field), `shopping`
  (`buildGroceryList` takes portions per recipe, response lists the week's recipes), `http/shopping` and
  the Bring! token payload.
- **Frontend:** planner batch banner (new "Kochen" entry, cooked-portions sheet removed), new
  `features/cooking-session/`, grocery-list sheet (portions inputs), API clients and query keys, i18n
  (de, en), app shell (sub-screen with hidden bottom nav, URL state).
- **Design:** the screens are designed in Claude Design next; `design.md` carries UX hints for that
  handoff.
