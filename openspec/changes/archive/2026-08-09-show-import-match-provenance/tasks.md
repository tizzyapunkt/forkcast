## 1. Backend — provenance always returned

- [x] 1.1 TDD the import use case: the provenance payload is attached to every successful draft, with `provenance.ingredients` positionally parallel to `draft.ingredients` (covering matched and unmatched rows), no configuration involved
- [x] 1.2 Remove the `includeDebug` flag from the import use case and handler, and delete the `RECIPE_IMPORT_DEBUG` env var and its config parsing
- [x] 1.3 Rename `RecipeDraftDebug` → `RecipeDraftProvenance`, `IngredientMatchDebug` → `IngredientMatchProvenance`, `SearchCandidateDebug` → `SearchCandidateProvenance`, `RawIngredientDebug` → `RawIngredientProvenance`, and the response field `debug` → `provenance` (backend types + frontend `domain/recipes.ts`)
- [x] 1.4 TDD the entry shape is unchanged by the rename: `raw`, `candidates` (rank order, cap 5), `chosen` (or `null`), `flags` including `missingAmount`
- [x] 1.5 TDD provenance is not persisted: saving a reviewed draft stores a recipe carrying no provenance data

## 2. Frontend — thread provenance to rows

- [x] 2.1 TDD `ReviewImportScreen`: each initial matched row is paired with its provenance entry by draft index at load time; rows appended later (resolve flow, manual picker) carry none
- [x] 2.2 TDD the pairing survives row mutation: replacing a row's ingredient, editing its amount, or removing an earlier row leaves each remaining row paired with its original provenance
- [x] 2.3 Add an optional per-row provenance prop to `RecipeIngredientEditor`; verify the ordinary recipe editor call site is unchanged and renders no provenance affordances

## 3. Frontend — raw extracted line

- [x] 3.1 TDD the raw line renders beneath the matched name, visually subordinate, showing the extracted name with amount and unit when present, truncated to one line
- [x] 3.2 TDD a mismatch is legible in place: model read `Kirschtomaten`, matcher chose `Tomatenmark` → the row shows both
- [x] 3.3 TDD a manually added row shows no raw line, and replacing a row's ingredient leaves its raw line unchanged

## 4. Frontend — candidate-first replacement

- [x] 4.1 TDD `RecipeIngredientPicker` in `replace` mode: renders the row's candidates in rank order above the search input, each labelled with name and source, before any query is typed
- [x] 4.2 TDD selecting a candidate resolves it to a real search result by exact name against its source, applies it through the existing `onPickResult` path (row keeps its amount, `pieceQuantity` carried when the new unit is mass, note dropped), and closes the picker
- [x] 4.3 TDD an unresolvable candidate (entry deleted since import) falls back to the search input with a notice and does not apply a macro-less row
- [x] 4.4 TDD no candidate section renders for an empty `candidates` array or for a manually added row; the search flow is unchanged in both cases

## 5. Frontend — uncertainty marker

- [x] 5.1 TDD marker visibility derived at render: shown when any flag is true, or `chosen` is non-null with `candidates.length > 1`; hidden for a single-candidate match with no flags
- [x] 5.2 TDD marker copy names the condition in German (unit replaced, piece quantity dropped, untracked inherited, amount missing, alternatives available)
- [x] 5.3 TDD the marker never blocks submission and needs no dismissal

## 6. Cleanup and i18n

- [x] 6.1 Delete `features/ai-recipe-import/debug-box.tsx` and its tests; remove its render from `ReviewImportScreen`
- [x] 6.2 Add German strings for the raw line prefix, the candidate section heading, the unresolvable-candidate notice, and each marker condition

## 7. Verify

- [x] 7.1 `make check` green (lint + typecheck + fmt-check + tests, both workspaces) with no new warnings
- [x] 7.2 Browser smoke via `make dev-http`: import a real multi-ingredient recipe photo; confirm every imported row shows its raw extracted line, that a mis-matched row is identifiable without opening a photo, that opening replace lists the candidates and one tap swaps the row, and that the recipe saves normally (11-ingredient German recipe photo → 10 matched rows, all with a raw line; `Cherrytomate` ← „200 g Kirschtomaten" was spotted without opening the photo; replace on `Rote Zwiebel` listed both candidates and one tap swapped it to `Zwiebel` keeping amount + piece tracking; saved recipe stored no provenance fields)
- [x] 7.3 Sanity-check marker density against that real import — if nearly every row is marked, tighten the ambiguity threshold rather than removing the marker (see design.md — Risks) (5/10 rows marked, but the ambiguity clause fired on only **1** row — threshold left as-is. The other 4 are `untrackedInherited` on Frei-mode rows that already render the „Zählt nicht in die Nährwerte" caption; that duplication is the marker's real noise source, not the threshold. Flagged for follow-up — removing it would contradict this change's own spec requirement.)
