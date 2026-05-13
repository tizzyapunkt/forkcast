## 1. Backend domain — displayQuantity field & relaxed untracked rule (TDD)

- [x] 1.1 Add failing test cases in `backend/src/domain/recipes/validate-ingredient-shape.test.ts` (new file if not present) covering: tracked rejects `displayQuantity`; untracked accepts valid `displayQuantity`; empty `unitLabel` rejected; overlong `unitLabel` (>24 chars) rejected; untracked with `amount = 0` accepted; tracked with `amount = 0` rejected; untracked still requires `unit`; backwards-compat read of legacy untracked rows.
- [x] 1.2 Extend `backend/src/domain/recipes/types.ts` `RecipeIngredient` with `displayQuantity?: { amount: number; unitLabel: string }`.
- [x] 1.3 Update `backend/src/domain/recipes/validate-ingredient-shape.ts` to: allow `displayQuantity` only when `untracked === true`; validate `unitLabel` (trimmed non-empty, ≤24 chars); validate `amount` is finite ≥ 0; relax untracked `amount` rule from `> 0` to `≥ 0`; keep tracked `amount > 0`.
- [x] 1.4 Update `backend/src/domain/recipes/add-recipe.use-case.test.ts` and `update-recipe.use-case.test.ts` with cases that persist and read back `displayQuantity` on untracked rows.
- [x] 1.5 Confirm `add-recipe.use-case.ts` / `update-recipe.use-case.ts` are pass-through (no changes likely needed beyond making sure they spread the new field).
- [x] 1.6 Update HTTP request schemas in `backend/src/http/recipes/recipes.handler.ts` to accept the new field (Zod). — N/A: handler is pass-through, validation happens in the use case via `validateIngredientShape`. No Zod layer to extend.
- [x] 1.7 Run `pnpm --filter @forkcast/backend test` — all new tests pass; no regressions.

## 2. Backend AI import — capture & forward displayQuantity (TDD)

- [x] 2.1 Add failing test cases in `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.test.ts` covering: matched-untracked with `rawDisplayUnitLabel + rawDisplayAmount` produces `displayQuantity`; matched-untracked with only `rawDisplayUnitLabel` produces `displayQuantity` with `amount: 1`; matched-untracked with no raw display fields produces no `displayQuantity`; matched-tracked drops raw display fields and produces no `displayQuantity`; unmatched row never carries `displayQuantity`; matched-untracked with no extracted amount persists with canonical `amount = 0`.
- [x] 2.2 Extend `backend/src/domain/ai-recipe-import/types.ts` `RawIngredient` with optional `rawDisplayAmount?: number; rawDisplayUnitLabel?: string`. Extend `MatchedDraftIngredient` with optional `displayQuantity?: { amount: number; unitLabel: string }`.
- [x] 2.3 Update `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.ts` `matchIngredient` to: when `top.untracked === true` and `raw.rawDisplayUnitLabel?.trim()` is non-empty, set `matched.displayQuantity = { amount: raw.rawDisplayAmount ?? 1, unitLabel: raw.rawDisplayUnitLabel.trim() }`; when `matched-untracked` row has no `amount` and no piece-derived total, set canonical `amount` to `0`.
- [x] 2.4 Update `backend/src/domain/ai-recipe-import/recipe-draft-extractor.ts` Anthropic tool schema to include optional `rawDisplayAmount`, `rawDisplayUnitLabel` per ingredient. Update the system prompt to instruct the model to populate these fields when the recipe uses non-canonical units (TL/EL/Prise/Schuss/n. Geschmack/etc.) for seasonings/spices/herbs.
- [x] 2.5 Update extractor parsing to pass `rawDisplayAmount`/`rawDisplayUnitLabel` through to `RawIngredient`.
- [x] 2.6 Run `pnpm --filter @forkcast/backend test` — all new tests pass.

## 3. Frontend domain — computeRecipeTotals + scaling (TDD)

- [x] 3.1 Mirror the backend type change: extend `frontend/src/domain/recipes.ts` `RecipeIngredient` with `displayQuantity?: { amount: number; unitLabel: string }`.
- [x] 3.2 Create `frontend/src/domain/recipe-totals.test.ts` with failing cases: tracked row sums; untracked row excluded; empty list → zeros; non-positive yield treated as 1; multi-row mix; per-serving math.
- [x] 3.3 Create `frontend/src/domain/recipe-totals.ts` exporting `computeRecipeTotals(ingredients, yield)`.
- [x] 3.4 Extend `frontend/src/domain/scale-recipe-ingredients.test.ts` with cases: untracked row with `displayQuantity` scales `displayQuantity.amount` by factor; `unitLabel` invariant; mixed `pieceQuantity` + `displayQuantity` (never co-occur on a row, but a recipe may contain both kinds of rows) scales each correctly.
- [x] 3.5 Update `frontend/src/domain/scale-recipe-ingredients.ts` and `frontend/src/features/recipes/scale-ingredient.ts` to scale `displayQuantity.amount` alongside `amount` and `pieceQuantity.amount`; leave `displayQuantity.unitLabel` invariant.
- [x] 3.6 Run `pnpm --filter @forkcast/frontend test` — all new tests pass.

## 4. Frontend — recipe ingredient editor: displayQuantity inline editor (TDD)

- [x] 4.1 Add failing test cases in `frontend/src/features/recipes/recipe-ingredient-editor.test.tsx`: untracked row without `displayQuantity` shows `+ Menge ergänzen` button; tapping reveals inline form; submitting writes `displayQuantity` to state; untracked row with `displayQuantity` renders `{amount} {unitLabel}` in place of canonical; ✎ affordance opens prefilled editor; "Menge entfernen" clears `displayQuantity`; tracked row does NOT show the affordance; toggling untracked → tracked clears any `displayQuantity` from state.
- [x] 4.2 Implement the inline editor in `frontend/src/features/recipes/recipe-ingredient-editor.tsx` — model the UI on the existing `AttachPieceForm` (numeric input + free-text input + ✓ / ✕). Inputs validate: amount finite ≥ 0; unitLabel non-empty trim, ≤24 chars; disable ✓ until valid.
- [x] 4.3 When rendering an untracked row, if `displayQuantity` is present, render `{displayQuantity.amount} {displayQuantity.unitLabel}` in place of `{amount} {unit}`. Keep muted styling and untracked badge.
- [x] 4.4 In `handleToggleUntracked`, when toggling to tracked, remove any `displayQuantity` from the row in form state.
- [x] 4.5 Add new i18n strings under `de.recipeIngredientEditor`: `addDisplayQuantity` (`"+ Menge ergänzen"`), `editDisplayQuantityAria(name)`, `displayQuantityAmountAria(name)`, `displayQuantityUnitAria(name)`, `displayQuantityUnitPlaceholder` (`"z. B. TL, Prise"`), `removeDisplayQuantity` (`"Menge entfernen"`).
- [x] 4.6 Run `pnpm --filter @forkcast/frontend test recipe-ingredient-editor` — all new tests pass.

## 5. Frontend — recipe form: live totals strip (TDD)

- [x] 5.1 Add failing test cases in `frontend/src/features/recipes/recipe-form.test.tsx` (new file if not present): empty form shows `0 kcal · 0 P / 0 C / 0 F` per serving; adding a tracked ingredient updates the strip; toggling that ingredient untracked sets it back to zero; editing the amount updates the strip; changing yield updates per-serving (total invariant).
- [x] 5.2 Create `frontend/src/features/recipes/recipe-totals-strip.tsx` — a small component that renders per-serving and total lines via `computeRecipeTotals`. Accepts `{ ingredients, yield }` props.
- [x] 5.3 Wire `RecipeTotalsStrip` into `frontend/src/features/recipes/recipe-form.tsx` between the ingredient editor and the action buttons.
- [x] 5.4 Add new i18n strings under `de.recipeForm` (or a new `de.recipeTotals` namespace): `perServingLabel` (`"Pro Portion"`), `totalLabel` (`"Gesamt"`), `kcalUnit` (`"kcal"`), `proteinShort` (`"P"`), `carbsShort` (`"C"`), `fatShort` (`"F"`).
- [x] 5.5 Run `pnpm --filter @forkcast/frontend test recipe-form` — all new tests pass.

## 6. Frontend — recipe read view: totals strip + displayQuantity rendering (TDD)

- [x] 6.1 Add failing test cases in `frontend/src/features/recipes/recipe-detail.test.tsx`: totals strip renders per-serving line; "Bei N Portionen" line scales with multiplier; untracked rows excluded from totals; untracked row with `displayQuantity` renders `{amount} {unitLabel}` in cooking view; multiplier scales `displayQuantity.amount`; multiplier reset returns to stored amounts.
- [x] 6.2 Render `RecipeTotalsStrip` (or a thin wrapper that exposes the "Bei N Portionen" line bound to the current multiplier) near the top of `recipe-detail.tsx`, above the ingredients section.
- [x] 6.3 Update the row rendering in `recipe-detail.tsx` to honor `displayQuantity` for untracked rows: when `scaled.untracked && scaled.displayQuantity` is present, render `{formatPieceCount(scaled.displayQuantity.amount)} {scaled.displayQuantity.unitLabel}` in place of the existing mass formatter.
- [x] 6.4 Verify the multiplier code path correctly scales `displayQuantity.amount` via the updated `scaleIngredient` helper.
- [x] 6.5 Run `pnpm --filter @forkcast/frontend test recipe-detail` — all new tests pass.

## 7. Frontend — recipes list: per-recipe macro line (TDD)

- [x] 7.1 Add failing test cases in `frontend/src/features/recipes/recipes-screen.test.tsx`: list row renders the macro line `{kcal} kcal · {P} P / {C} C / {F} F` using per-serving totals; untracked rows excluded from rollup; existing meta line still rendered.
- [x] 7.2 Update `frontend/src/features/recipes/recipes-screen.tsx` row render to compute `computeRecipeTotals(recipe.ingredients, recipe.yield).perServing` and render a second line beneath the recipe name. Keep the existing meta line.
- [x] 7.3 Add an i18n helper `de.recipes.macroLine(kcal, p, c, f)` returning the formatted string.
- [x] 7.4 Run `pnpm --filter @forkcast/frontend test recipes-screen` — all new tests pass.

## 8. Frontend — AI import review: carry displayQuantity through (TDD)

- [x] 8.1 Add failing test cases in `frontend/src/features/ai-recipe-import/review-import-screen.test.tsx`: importer-provided `displayQuantity` round-trips through to save payload; user adds `displayQuantity` to an imported untracked row before saving; user toggles tracked → untracked and adds `displayQuantity`; toggling untracked → tracked clears `displayQuantity` from save payload.
- [x] 8.2 Update `frontend/src/features/ai-recipe-import/review-import-screen.tsx` `buildInitialMatchedIngredients` to copy `displayQuantity` from each matched draft into the initial form state.
- [x] 8.3 Mirror the new type in any frontend domain types the screen depends on (`frontend/src/domain/recipes.ts` `MatchedDraftIngredient` gains `displayQuantity?`).
- [x] 8.4 Run `pnpm --filter @forkcast/frontend test review-import-screen` — all new tests pass.

## 9. End-to-end verification

- [x] 9.1 Run `pnpm --filter @forkcast/backend test` and `pnpm --filter @forkcast/frontend test` together — full green. (285 backend + 275 frontend)
- [x] 9.2 Run `pnpm --filter @forkcast/backend lint` and `pnpm --filter @forkcast/frontend lint` — clean.
- [x] 9.3 Per `[[feedback_smoke_testing]]`: disable HTTPS in `frontend/vite.config.ts`, start `pnpm dev`, smoke-test the happy paths in Chrome — (a) create recipe with seasoning marked untracked + `1 TL` displayQuantity → totals strip excludes it → save → re-open → cooking view still shows `1 TL`; (b) recipes list shows macro line; (c) cooking view multiplier scales both ingredient rows and the "Bei N Portionen" total; (d) AI-import a sample recipe with `1 TL Salz` and verify the matched-untracked row arrives with `displayQuantity` populated. — Verified by user ("Alles passt!").
- [x] 9.4 Run `openspec validate "recipe-edit-ux-improvements"` — change is valid.
