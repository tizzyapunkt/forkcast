## 1. Tests first (TDD)

- [x] 1.1 In `frontend/src/features/recipes/recipe-ingredient-editor.test.tsx`, add a test: a tracked ingredient with `macrosPerUnit = { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 }` and `amount = 200` renders a sub-line containing `500 kcal · 52g P · 0g K · 30g F`.
- [x] 1.2 Add a test: an ingredient with `untracked: true` (and any `macrosPerUnit`/`amount`) renders NO kcal/macro sub-line — assert no `g P`, no `g K`, no `g F`, and no `kcal` text within the untracked row.
- [x] 1.3 Add a test: editing the amount input on a tracked row from `100` to `250` (with `macrosPerUnit = { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 }`) updates the sub-line synchronously to `413 kcal · 78g P · 0g K · 9g F` on the same render — no timers, no waitFor on network.
- [x] 1.4 Add a test: editing the piece-count input on a piece-tracked row updates the macro sub-line live (e.g. `pieceQuantity = { amount: 1, gramsPerPiece: 150 }` + count change to `2` produces macros derived from `amount = 300`).
- [x] 1.5 Add a test: editing grams-per-piece on a piece-tracked row updates the macro sub-line live.
- [x] 1.6 Add a test: clicking the untracked toggle on a row that previously showed a macro sub-line removes the sub-line on the next render; clicking it again restores the sub-line.
- [x] 1.7 Run `pnpm --filter @forkcast/frontend test -- --run src/features/recipes/recipe-ingredient-editor.test.tsx` and confirm the new tests fail for the right reasons (macros not yet rendered).

## 2. Implementation

- [x] 2.1 In `frontend/src/features/recipes/recipe-ingredient-editor.tsx`, inside each `<li>` rendering an ingredient, add a small `text-xs text-muted-foreground` sub-line directly below the name/amount row (above the untracked toggle) that shows `{kcal} kcal · {P}g P · {C}g K · {F}g F`.
- [x] 2.2 Compute the per-row values as `ingredient.macrosPerUnit.{calories,protein,carbs,fat} * ingredient.amount`, integer-rounded. Reuse `de.dailyLog.macroInline(p, c, f)` and strip its leading `· ` (same pattern as `slot-card.tsx`).
- [x] 2.3 Guard the sub-line so it renders only when `ing.untracked !== true`. Do not emit zero placeholders for untracked rows.
- [x] 2.4 Verify no new state is added to `RecipeIngredientEditor` — derivations only. The existing controlled-state flow drives live updates.
- [x] 2.5 Re-run `pnpm --filter @forkcast/frontend test -- --run src/features/recipes/recipe-ingredient-editor.test.tsx`; tests 1.1–1.6 must pass.

## 3. Cross-feature regression check

- [x] 3.1 Run the full frontend test suite: `pnpm --filter @forkcast/frontend test`. Verify all daily-log tests still pass (the macro inline helper is shared) and that `recipe-form.test.tsx`, `recipes-screen.test.tsx`, `recipe-detail.test.tsx`, and `recipe-ingredient-picker.test.tsx` are green.
- [x] 3.2 If any existing recipe-editor test now matches the macro text in more places than intended (analogous to the `daily-log-screen.test.tsx` regression we hit before), tighten its query to the specific row/element rather than the section.

## 4. Smoke test

- [x] 4.1 Per `feedback_smoke_testing.md`, disable HTTPS in `frontend/vite.config.ts` before smoke testing (do NOT commit this).
- [x] 4.2 Start `pnpm dev`. Open an existing recipe in edit mode in Chrome.
- [x] 4.3 Verify on a 360px-wide viewport: every tracked ingredient row shows kcal + macros on a sub-line; the line updates as you type into the amount input, the piece-count input, and the grams-per-piece input.
- [x] 4.4 Verify an untracked row (or a row toggled to untracked while watching) shows NO macro sub-line. Toggle it back and confirm the line reappears.
- [x] 4.5 Open the "New recipe" form, add a tracked ingredient via the picker, confirm the sub-line appears immediately with values derived from the picked amount.
- [x] 4.6 Re-enable HTTPS in `vite.config.ts` before committing.

## 5. Lint, format, finalize

- [x] 5.1 Run `pnpm --filter @forkcast/frontend lint` and `pnpm --filter @forkcast/frontend format`.
- [x] 5.2 Re-run all frontend tests: `pnpm --filter @forkcast/frontend test`.
- [x] 5.3 Verify no backend files were modified (frontend-only change).
