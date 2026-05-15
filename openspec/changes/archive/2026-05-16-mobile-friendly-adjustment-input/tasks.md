## 1. i18n

- [x] 1.1 Add direction labels to `frontend/src/i18n/de.ts` under `bodyProfile`: `adjustmentDirection.deficit` = "Defizit", `adjustmentDirection.maintenance` = "Erhalt", `adjustmentDirection.surplus` = "Überschuss"
- [x] 1.2 Add an `adjustmentMagnitudeLabel` (e.g. "Anpassung in %") and an aria-label for the direction segmented control

## 2. Tests (TDD — write first, watch them fail)

- [x] 2.1 In `body-profile-form.test.tsx`, add a test: selecting "Defizit" + typing `20` saves a profile with `adjustmentPercent: -20`
- [x] 2.2 Add a test: selecting "Überschuss" + typing `10` saves `adjustmentPercent: 10`
- [x] 2.3 Add a test: selecting "Erhalt" disables the magnitude input and saves `adjustmentPercent: 0` (also when a magnitude was previously set)
- [x] 2.4 Add a test: loading an existing profile with `adjustmentPercent: -20` renders "Defizit" selected and magnitude `20`
- [x] 2.5 Add a test: selecting the `fat-loss` phase preset shows "Defizit" + magnitude `20`
- [x] 2.6 Add a test: entering magnitude `50` while "Defizit" is selected surfaces the existing `adjustmentRange` error and blocks save
- [x] 2.7 Update the existing test that asserts loading `adjustmentPercent: -20` (line ~49) to read the new controls rather than the old number input

## 3. Form implementation

- [x] 3.1 In `body-profile-form.tsx`, add local UI state for `adjustmentDirection` (`'deficit' | 'maintenance' | 'surplus'`) and `adjustmentMagnitude` (`number`). These live outside the zod schema.
- [x] 3.2 Initialize the two helpers from `adjustmentPercent` on mount and on `reset(existing.profile)`: `direction = sign === -1 ? 'deficit' : sign === 1 ? 'surplus' : 'maintenance'`, `magnitude = Math.abs(adjustmentPercent)`
- [x] 3.3 Replace the single adjustment `<input>` block (`body-profile-form.tsx:291-301`) with: a 3-button segmented control bound to `adjustmentDirection`, and a numeric `<input inputMode="numeric" min="0" max="40" step="1">` bound to `adjustmentMagnitude`
- [x] 3.4 On direction change: if `maintenance`, force `adjustmentMagnitude` to `0` and disable the magnitude input. Then write the derived `adjustmentPercent` via `setValue('adjustmentPercent', derived, { shouldValidate: true })`
- [x] 3.5 On magnitude change: write the derived `adjustmentPercent` via `setValue` so the preview and zod validation update in lockstep
- [x] 3.6 Update `onPhaseChange` so picking a preset also updates the two helpers (`direction = sign(preset.adjustmentPercent)`, `magnitude = abs(preset.adjustmentPercent)`) in addition to the existing `setValue('adjustmentPercent', ...)`
- [x] 3.7 Keep the existing error surface for `errors.adjustmentPercent` — render it under the magnitude input

## 4. Verify

- [x] 4.1 Run `pnpm --filter @forkcast/frontend test` — all tests pass
- [x] 4.2 Run `pnpm --filter @forkcast/frontend lint`
- [x] 4.3 Smoke test on the settings screen: pick each phase preset, manually flip direction, set a magnitude, click save, reload, confirm the saved value re-hydrates the controls correctly
- [x] 4.4 Smoke test on a real mobile device (or Chrome devtools mobile emulation): focus the magnitude input and confirm a numeric keyboard appears; pick "Defizit" and confirm saving produces a negative `adjustmentPercent`
