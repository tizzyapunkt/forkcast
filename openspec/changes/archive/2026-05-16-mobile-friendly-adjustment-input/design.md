## Context

The body profile form's `adjustmentPercent` is a signed integer in `[-40, +40]` representing the calorie deficit (negative) or surplus (positive) applied to TDEE. It is currently rendered as a single `<input type="number" inputMode="numeric">`. On iOS and Android, that input mode shows a digits-only software keyboard with no minus sign and no comma — so the field is effectively read-only for any cut target, and forkcast is a mobile-first PWA where this is the primary input surface.

The persisted shape, validation bounds (`[-40, +40]`, integer), and downstream calorie/macro computation are correct and must stay unchanged. Only the *entry UX* needs to be replaced.

Existing phase presets already pre-fill an adjustment (`fat-loss: -20`, `recomposition: 0`, `gain: +10`), so the form already has a notion of "direction" implicit in `goalPhase`. We will not couple direction to phase, however — users must still be able to override the adjustment independently (e.g. a small −10% cut while staying in recomposition).

## Goals / Non-Goals

**Goals:**

- Allow entering a negative adjustment on a mobile numeric keyboard with no platform workarounds.
- Keep the persisted `adjustmentPercent` value, type, and validation contract unchanged.
- Keep phase presets working with a single tap.
- Preserve the existing zod schema and React Hook Form integration shape that the rest of the form relies on.

**Non-Goals:**

- Adding decimal precision to `adjustmentPercent` (spec is `.int()`).
- Replacing other numeric inputs on the form (weight, height, age, fat percent — all are non-negative and already work).
- Adding a slider or stepper variant (rejected during proposal review in favor of a segmented direction toggle).
- Backend or storage changes.

## Decisions

### Decision: Two-control composite, one signed value

Render two visually distinct controls bound to one underlying form field:

1. **Direction**: a 3-segment toggle — `deficit | maintenance | surplus`. Labels (German UI): `Defizit / Erhalt / Überschuss`.
2. **Magnitude**: a positive integer input bound to `inputMode="numeric"`, range `0..40`, step `1`.

The persisted `adjustmentPercent` is derived at submit/preview time:

```
direction === 'deficit'     → -magnitude
direction === 'maintenance' → 0
direction === 'surplus'     → +magnitude
```

When `direction === 'maintenance'`, the magnitude input is disabled and its value is forced to 0 in form state so the preview matches what will be saved.

**Why over alternatives:**

- *`inputMode="text"`*: would surface the full alphabetic keyboard on mobile — high friction for a numeric field.
- *Slider*: less precise, harder to land on an exact value, and not as discoverable for the actual integer being chosen.
- *Stepper +/−*: requires up to 40 taps to reach the edge of the range; clumsy compared to typing.

### Decision: Store the composite as a derived field, not in the schema

The zod schema and the persisted `BodyProfile` keep `adjustmentPercent: number` exactly as today. The form's internal React Hook Form state gains two helper fields (`adjustmentDirection`, `adjustmentMagnitude`) that are *not* part of the zod schema — they are local UI state derived from / written back to `adjustmentPercent` via `watch` + `setValue`.

This keeps the domain model untouched and avoids leaking a UI concern into the persistence boundary. It also keeps the preview computation (which reads `adjustmentPercent`) working without change.

**Initialization**: when an existing profile loads, derive direction from `Math.sign(adjustmentPercent)` and magnitude from `Math.abs(adjustmentPercent)`.

**Phase presets**: when a phase is picked, set both `adjustmentPercent` (as today) *and* the two helper fields. This keeps presets one-tap.

### Decision: Validation still anchored on `adjustmentPercent`

zod validation continues to run against the derived `adjustmentPercent` (`[-40, +40]`, integer). The magnitude input gets an `<input>` `min=0 max=40` for the soft mobile UX hint, but the source of truth for validation errors stays the same single field. This avoids two parallel error stories.

If a user types a magnitude > 40, the derived value falls outside the bound and the existing `adjustmentRange` error fires — same message, same field.

## Risks / Trade-offs

- [Form state now has UI-only fields not in the zod schema] → Keep them as `useState` or unregistered RHF fields; do not include them in the `FormValues` type that's passed to `saveMutation`. Add a comment at the declaration so a future reader knows they're intentionally outside the schema.
- [Existing tests assert against the single `adjustmentPercent` input] → Update tests to drive the new controls; behavior-level assertions on the saved profile should remain unchanged (still expect `adjustmentPercent: -20` after picking fat-loss).
- [Users who previously typed `-20` directly lose the ability to do so] → Acceptable: the proposal accepts this as the cost of mobile usability. Desktop users get the same controls, but the segmented toggle is a single click.
- [Maintenance state must keep magnitude=0 in sync] → Force magnitude to 0 in the `onChange` of the direction toggle when `maintenance` is selected; disable the magnitude input so the user can't see a stale "20" while the saved value is 0.
