## 1. Tests first (TDD)

- [x] 1.1 In `frontend/src/features/daily-log/entry-row.test.tsx`, add a test: a `full` entry with `macrosPerUnit = { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 }` and `amount = 200` renders `500 kcal · 52g P · 0g K · 30g F`.
- [x] 1.2 In the same file, add a test: a `quick` entry with `calories = 250, protein = 20, carbs = 15, fat = 10` renders `250 kcal · 20g P · 15g K · 10g F`.
- [x] 1.3 In the same file, add a test: a `quick` entry with only `calories = 80` (no macro fields) renders `80 kcal` and NO macro suffix.
- [x] 1.4 In the same file, add a test: a `quick` entry with `calories = 80, protein = 5` but no `carbs`/`fat` renders `80 kcal` and NO macro suffix (no zero fabrication).
- [x] 1.5 In `frontend/src/features/daily-log/daily-log-screen.test.tsx`, add a test that asserts the slot header still shows `{kcal} kcal` plus the macro line when the API returns a slot with non-partial macros, and that the macro line is suppressed when `totals.macrosPartial === true`.
- [x] 1.6 Run `pnpm --filter @forkcast/frontend test` and confirm the new tests fail for the right reasons (macros not yet rendered on entry row; slot layout assertion fails if applicable).

## 2. Implement per-entry macros in `entry-row.tsx`

- [x] 2.1 In `frontend/src/features/daily-log/entry-row.tsx`, compute the per-entry macro triple: for `type === 'full'` derive `{ protein, carbs, fat }` as `macrosPerUnit.{...} * amount`; for `type === 'quick'` use the optional fields directly.
- [x] 2.2 Determine `hasMacros = entry.ingredient.type === 'full' || (quick && protein !== undefined && carbs !== undefined && fat !== undefined)`. Do NOT default missing quick fields to 0.
- [x] 2.3 Render the macro suffix using the existing `de.dailyLog.macroInline(p, c, f)` helper inside the trailing kcal span, mirroring how `slot-card.tsx` already uses it (small, muted style).
- [x] 2.4 Ensure the trailing cluster stays right-aligned and that the entry's name column remains the column that truncates on overflow (apply `shrink-0` to the trailing cluster if needed).
- [x] 2.5 Run `pnpm --filter @forkcast/frontend test`; tests from 1.1–1.4 must pass.
- [x] 2.6 Add a failing test in `entry-row.test.tsx`: editing the inline amount input on a full entry updates the row's calories and macros before the debounced PATCH fires.
- [x] 2.7 Add an optional `onLiveAmount?: (parsed: number | null) => void` callback to `InlineAmountInput`. Fire `null` when the input is empty or below `MIN_AMOUNT`; fire the parsed positive amount otherwise. Existing debounce + PATCH behavior unchanged.
- [x] 2.8 In `entry-row.tsx`, hold a `liveAmount` state and pass `setLiveAmount` as `onLiveAmount` to `InlineAmountInput`. Derive `effectiveAmount = liveAmount ?? ingredient.amount` for full entries and compute kcal + macros from it. Re-run tests; the new live-update test must pass and nothing else regresses.

## 3. Promote slot summary layout in `slot-card.tsx`

- [x] 3.1 In `frontend/src/features/daily-log/slot-card.tsx`, keep the existing kcal value on the top row alongside the `+` button, but move the macro suffix to a second line directly under the slot title.
- [x] 3.2 Preserve the current suppression rules exactly: macro line hidden when `totals.calories === 0`, when all of `totals.protein/carbs/fat` are 0, or when `totals.macrosPartial === true`. No behavioral change here — only layout.
- [x] 3.3 Confirm tests from 1.5 pass.

## 4. Smoke test

- [x] 4.1 Per `feedback_smoke_testing.md`, disable HTTPS in `frontend/vite.config.ts` before smoke testing (remove the `basicSsl()` plugin entry, do NOT commit).
- [x] 4.2 Start `pnpm dev`. Open the daily log in Chrome via the claude-in-chrome tools (after loading the relevant tools via ToolSearch).
- [x] 4.3 Verify on a 360px-wide viewport: a full entry renders kcal + macros without horizontal overflow; a quick entry without macros renders kcal only.
- [x] 4.4 Verify each slot header shows the kcal value on the title row and the macro line on a second line below the title; verify a slot with a quick entry missing macros shows kcal only on the slot header.
- [x] 4.5 Re-enable HTTPS in `vite.config.ts` before committing.

## 5. Lint, format, finalize

- [x] 5.1 Run `pnpm --filter @forkcast/frontend lint` and `pnpm --filter @forkcast/frontend format` (or the project's configured oxlint/oxfmt scripts).
- [x] 5.2 Re-run all frontend tests: `pnpm --filter @forkcast/frontend test`.
- [x] 5.3 Verify no backend files were modified (this change is frontend-only).
