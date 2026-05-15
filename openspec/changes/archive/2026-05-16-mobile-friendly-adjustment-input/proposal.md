## Why

The macro calculator's calorie adjustment field accepts integers in `[-40, +40]`, but on mobile the field renders a numeric-only software keyboard with no minus key. Users cannot enter a deficit (negative value), which makes the form unusable for cutting on phones — the primary device for this PWA.

## What Changes

- Replace the single signed number input for `adjustmentPercent` with a two-part control:
  - A segmented direction toggle (Defizit / Erhalt / Überschuss) that picks the sign
  - A positive integer magnitude input (0–40) for the amount
- The persisted `adjustmentPercent` is derived: `direction === 'deficit' ? -magnitude : direction === 'surplus' ? +magnitude : 0`.
- When direction is "Erhalt" (maintenance), the magnitude is forced to 0 and the magnitude input is disabled.
- Phase presets (fat-loss / recomposition / gain) drive both controls so the existing one-tap preset flow still works.
- Backend storage, validation bounds, and the computed result are unchanged — this is a frontend UX-only change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `macro-calculator`: add a UX requirement governing how the calorie adjustment is entered on the body-profile form, without changing the persisted value, bounds, or computation.

## Impact

- Frontend: `frontend/src/features/body-profile/body-profile-form.tsx` (form layout + form-state shape for the adjustment control), `body-profile-form.test.tsx`, and German i18n strings in `frontend/src/i18n/de.ts` for the direction labels.
- Backend: no changes. `BodyProfile.adjustmentPercent` keeps its `[-40, +40]` integer contract.
- No data migration: the persisted value is still a signed integer.
