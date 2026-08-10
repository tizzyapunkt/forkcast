# Show Import Match Provenance on the Review Screen

## Why

When the AI import picks the wrong food, the review screen hides every clue needed to notice it. An ingredient row shows only the **matched catalog name** — if the photo said *Kirschtomaten* and the matcher landed on *Tomatenmark*, the row reads `Tomatenmark` and looks correct. The only way to catch it is to scroll to the top of a ~2500px form, open a photo, hold the line in memory, scroll back, and compare. That loop runs once per ingredient.

Meanwhile the backend already computes exactly what would end the loop, and throws it away. `RecipeDraftDebug` carries, per ingredient: `raw` (what the model read, verbatim), `candidates` (the winning tier's top 5 in rank order), `chosen`, and the post-match `flags`. Two things bury it: the frontend never requests it (`importRecipeFromPhotos` sends only `{ images }`, so `RECIPE_IMPORT_DEBUG` is effectively unreachable from the app), and even when present it renders as a collapsed monospace box *below the submit button*.

So swapping a mis-matched ingredient means opening a sheet with an empty search box and typing a query the server already answered seconds earlier.

## What Changes

- **Provenance is always returned, and renamed.** The per-ingredient match record ships on every import response instead of being gated behind `RECIPE_IMPORT_DEBUG`, and `debug` becomes `provenance` — it is user-facing data now, not a developer aid. The env var and its gating are removed.
- **Each row shows what the AI read.** Matched ingredient rows render the raw extracted line beneath the matched name (`Tomatenmark` · *gelesen: „2 EL Tomatenmark"*), so a transcription-vs-match mismatch is visible without opening a photo.
- **Swapping starts from the ranked candidates.** Opening the replace flow on an imported row presents that row's already-computed candidates as one-tap options, above the search box. Picking one applies it directly; the search box remains for everything else.
- **Rows whose match deserves a look are marked.** The existing flags (`unitOverridden`, `pieceQuantityDropped`, `untrackedInherited`) and a zero-candidate match are surfaced as a quiet inline marker on the affected row, so attention goes where the matcher was least certain.
- **The debug box is removed**, along with `DebugBox` and its monospace rendering — its content now lives inline, in German, where the decision is made.

Explicitly out of scope: any change to extraction prompting or the verbatim source line the model returns, the two-pane desktop review layout, and photo handling. Those are the follow-up review-layout change.

**Depends on** `unify-editable-food-catalog`: candidate and chosen records carry `source: 'CATALOG' | 'SCAN'` after the cascade shortens. Apply that change first.

## Capabilities

### Modified Capabilities

- `ai-recipe-import`: the optional debug payload becomes an always-present, renamed `provenance` payload; the collapsed debug box is replaced by per-row provenance (raw extracted line, uncertainty marker) and by candidate-first ingredient replacement in the review screen's replace flow.

## Impact

- **Backend**: `includeDebug` gating and the `RECIPE_IMPORT_DEBUG` env var removed from the import handler, use case, and config; `RecipeDraftDebug`/`IngredientMatchDebug` renamed to provenance types; payload always attached.
- **Frontend**: `RecipeDraft.debug` → `provenance`; `DebugBox` deleted; `RecipeIngredientEditor` gains an optional per-row provenance subtitle and uncertainty marker; `RecipeIngredientPicker` in `replace` mode gains a candidate list fed by the row's provenance; `ReviewImportScreen` threads provenance through by ingredient index; new German strings.
- **API**: `POST /import-recipe-from-photos` responses always include `provenance`; the `debug` field no longer exists.
- **Data**: none — provenance is request-scoped and still never persisted; saved recipes are unchanged.
