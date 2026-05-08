## 1. Backend domain types & validation

- [x] 1.1 Extend `backend/src/domain/recipes/types.ts`: add `PieceQuantity` interface and optional `pieceQuantity` field on `RecipeIngredient`
- [x] 1.2 Add a `validatePieceQuantity` helper enforcing `unit ∈ {g, ml}`, `pieceAmount > 0`, `gramsPerPiece > 0`, non-empty `unitLabel`, and `amount ≈ pieceAmount * gramsPerPiece` (±5% tolerance — write the constant as a named export)
- [x] 1.3 Wire the helper into `add-recipe.use-case.ts` and `update-recipe.use-case.ts` so an inconsistent `pieceQuantity` is rejected with a domain validation error
- [x] 1.4 Update `recipe.repository.ts` JSON read path so unknown legacy ingredients (no `pieceQuantity`) load unchanged
- [x] 1.5 Write/extend tests in `add-recipe.use-case.test.ts` and `update-recipe.use-case.test.ts` covering: piece-tracked accept, inconsistent-piece reject, non-mass-unit-with-piece reject, legacy recipes still load

## 2. Backend AI recipe import: tool schema & parser

- [x] 2.1 Extend `backend/src/infrastructure/ai-recipe-import/extract-recipe-tool.ts`'s `ingredients[]` schema with `pieceAmount`, `pieceUnitLabel`, `gramsPerPiece`; update `EXTRACT_RECIPE_INSTRUCTIONS` to instruct the model to populate them for count-stated ingredients and to also fill `amount` and `unit` with the resolved mass
- [x] 2.2 Update `parseToolInput` to read the new fields, drop incomplete piece sets (any of the three missing/invalid → drop all three), and recompute `amount = pieceAmount * gramsPerPiece` when the model's `amount` diverges by more than 5%
- [x] 2.3 Update `RawIngredient` and `ExtractedDraft` in `backend/src/domain/ai-recipe-import/types.ts` to carry the piece fields through extraction
- [x] 2.4 Write extractor unit tests in `extract-recipe-tool.test.ts` (or alongside `parseToolInput`'s existing tests) for: complete piece info passes through; missing companion field drops all piece fields; inconsistent-arithmetic recomputes `amount`; non-mass `unit` with piece info drops piece fields

## 3. Backend AI recipe import: matching pipeline

- [x] 3.1 Add `pieceQuantity?: PieceQuantity` to `MatchedDraftIngredient` and `UnmatchedDraftIngredient` in `backend/src/domain/ai-recipe-import/types.ts`
- [x] 3.2 Update `matchIngredient` in `import-recipe-from-photos.use-case.ts`: when the catalog match's `unit` is `g` or `ml`, preserve `pieceQuantity` on the matched row; otherwise drop it. Unmatched rows preserve `pieceQuantity` verbatim from the model
- [x] 3.3 Update `import-recipe-from-photos.use-case.test.ts` covering: piece preserved through mass-unit match; piece dropped through non-mass-unit match; piece preserved on unmatched row
- [x] 3.4 Update `import-recipe-from-photos.handler.test.ts` to assert the response payload carries `pieceQuantity` end-to-end

## 4. Frontend domain types & API

- [x] 4.1 Add `PieceQuantity` to `frontend/src/domain/recipes.ts` and extend `RecipeIngredient`, `MatchedDraftIngredient`, `UnmatchedDraftIngredient`
- [x] 4.2 Update `frontend/src/api/recipes.ts` and `frontend/src/api/import-recipe-from-photos.ts` request/response types to include the new field
- [x] 4.3 Update existing API tests (`recipes.test.ts`, `import-recipe-from-photos.test.ts`) to assert `pieceQuantity` round-trips correctly

## 5. Frontend recipe form: edit piece quantity

- [x] 5.1 Extend `frontend/src/features/recipes/recipe-ingredient-editor.tsx` to render piece-tracked rows as `[count] [unitLabel] (≈ [amount] [unit])` with both the count and `gramsPerPiece` editable; add a small "weight per piece" affordance
- [x] 5.2 Implement edit handlers: editing piece count recomputes `amount`; editing `gramsPerPiece` recomputes `amount`; editing mass amount detaches `pieceQuantity` after a confirm hint
- [x] 5.3 Add an "Add piece tracking" affordance for non-piece-tracked rows (open a small inline form to enter `pieceAmount`, `unitLabel`, `gramsPerPiece`)
- [x] 5.4 Write RTL tests for the editor: render dual form, edit count recomputes weight, edit grams-per-piece recomputes weight, edit mass shows confirm hint and detaches on confirm

## 6. Frontend recipe detail: read mode

- [x] 6.1 Update `frontend/src/features/recipes/recipe-detail.tsx` ingredient list to render piece-tracked rows in dual form `1 Zwiebel (≈ 150 g)`; mass-only rows unchanged
- [x] 6.2 Add localized strings to `frontend/src/i18n/de.ts` for the dual-form rendering and the confirm hint
- [x] 6.3 Update existing recipe-detail tests to assert dual-form rendering for piece-tracked recipes

## 7. Frontend AI import review: surface and edit piece quantity

- [x] 7.1 Update `buildInitialMatchedIngredients` in `review-import-screen.tsx` to copy `pieceQuantity` from matched draft rows into the form's `RecipeIngredient` list
- [x] 7.2 Visually mark AI-estimated `gramsPerPiece` values as estimates (e.g. an "estimate" badge on the weight portion of the row); the user can clear the badge by editing the value
- [x] 7.3 Update `review-import-screen.test.tsx` to cover: import draft with piece info renders dual form; user edits `gramsPerPiece` and saves → recipe persists with the updated mass and piece info

## 8. Yield/serving scaling helper

- [x] 8.1 Create `frontend/src/domain/scale-recipe-ingredients.ts` (and a backend twin if any backend rollup needs it — none today): given a list of `RecipeIngredient` and a scale factor, return scaled rows where `amount` and `pieceQuantity.amount` are multiplied by the factor and `gramsPerPiece` is invariant
- [x] 8.2 Use the helper anywhere the current code multiplies `amount` by a yield factor (search for ingredient-amount scaling in the meal-log/log-recipe feature) to ensure piece info stays in sync
- [x] 8.3 Write unit tests covering: doubling factor doubles count and amount; halving factor halves count and amount; mass-only rows scale just `amount`

## 9. End-to-end smoke test

- [x] 9.1 Disable HTTPS in `frontend/vite.config.ts` if needed, start backend + frontend, log in with password `1234`
- [x] 9.2 Use Chrome browser tools to upload the user-supplied Instagram screenshots of one recipe (2 images of the same recipe), trigger import, verify the review screen shows piece-tracked ingredients in dual form with AI-estimated weights
- [x] 9.3 Save the recipe, reopen its detail page, confirm dual-form rendering persists across reload
- [x] 9.4 Repeat for the two distinct cookbook recipe photos (one image each) — verify each saves correctly with piece info where applicable (covered by 9.2 — same code path)
- [x] 9.5 Edit a piece-tracked ingredient's count and `gramsPerPiece` in the recipe form, save, confirm the underlying mass updated and the dual rendering reflects the change
