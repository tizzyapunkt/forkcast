## 1. Scaling helper (TDD)

- [x] 1.1 Write failing tests for a pure `scaleIngredient(ingredient, factor)` helper covering: mass-only row (only `amount` scales), piece-quantity row (both `amount` and `pieceQuantity.amount` scale, `gramsPerPiece` and `unitLabel` unchanged), untracked row (scales identically, `untracked` flag preserved), factor `1` is a no-op, factor `0.5` halves correctly
- [x] 1.2 Implement `scaleIngredient` (colocated with `recipe-detail.tsx` or a small sibling module) to make the tests pass
- [x] 1.3 Add a display-formatting helper (or inline format) for mass amounts (up to 1 decimal, trim trailing zeros) and piece counts (up to 2 decimals, trim trailing zeros); cover with focused tests

## 2. i18n labels

- [x] 2.1 Add German labels to `frontend/src/i18n/de.ts` for the multiplier control: label/aria for the servings field, decrement/increment aria, reset action, and (if used) a small caption referencing the stored yield

## 3. Servings multiplier UI in recipe detail (TDD)

- [x] 3.1 Write failing component tests for `RecipeDetail` covering: default multiplier equals `recipe.yield`; incrementing rescales mass-only and piece-quantity rows; decrement floor is `1`; reset returns to `recipe.yield` and is only shown when the value differs; untracked rows keep their muted styling and badge after scaling; steps text is unchanged when the multiplier changes
- [x] 3.2 Add local `useState` for the chosen serving count in `recipe-detail.tsx`, initialized from `recipe.yield`
- [x] 3.3 Render the stepper control (− / value / +) and a conditional reset button above (or beside) the Ingredients section
- [x] 3.4 Replace the direct `ing.amount` / `ing.pieceQuantity` reads in the ingredient list render with the output of `scaleIngredient(ing, factor)` and the display formatter; do not mutate the recipe prop
- [x] 3.5 Verify all component tests from 3.1 pass

## 4. Smoke test

- [x] 4.1 Ensure HTTPS is disabled in `vite.config.ts` (per smoke-testing convention), then run the dev stack
- [x] 4.2 In Chrome via the Claude-in-Chrome tools: open a recipe with `yield = 2` and at least one piece-quantity ingredient, change the multiplier to 4, verify the row shows the doubled piece count and weight; lower the multiplier to 1, verify halving; press reset, verify return to the stored yield; navigate away and back, verify the multiplier resets to the stored yield
- [x] 4.3 Capture a short GIF of the interaction for the PR

## 5. Lint, types, tests

- [x] 5.1 Run `pnpm --filter @forkcast/frontend lint` and resolve any new findings
- [x] 5.2 Run `pnpm --filter @forkcast/frontend test` and confirm the full suite is green (including the new tests)
- [x] 5.3 Run the TypeScript build / typecheck step used by the frontend and confirm no new errors
