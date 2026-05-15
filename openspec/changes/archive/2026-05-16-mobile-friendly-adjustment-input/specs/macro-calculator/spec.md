## ADDED Requirements

### Requirement: Calorie adjustment input is enterable on a mobile numeric keyboard

The body-profile form SHALL provide a way to enter any in-range value for `adjustmentPercent` (integer in `[-40, +40]`), including negative values, on a mobile software keyboard that does not include a minus key.

The system SHALL render the adjustment as two visually distinct controls bound to the single `adjustmentPercent` field:

1. A **direction** selector with three mutually exclusive options corresponding to `deficit` (negative), `maintenance` (zero), and `surplus` (positive).
2. A **magnitude** input — a non-negative integer in `[0, 40]` — entered on a numeric software keyboard.

The persisted `adjustmentPercent` SHALL be derived as:

- `deficit` → `-magnitude`
- `maintenance` → `0`
- `surplus` → `+magnitude`

#### Scenario: Selecting deficit and typing a magnitude produces a negative adjustment

- **WHEN** the user selects the deficit direction and types `20` into the magnitude input
- **THEN** the form's `adjustmentPercent` is `-20`, the live macro preview reflects a 20% deficit, and saving the profile persists `adjustmentPercent: -20`

#### Scenario: Selecting surplus and typing a magnitude produces a positive adjustment

- **WHEN** the user selects the surplus direction and types `10` into the magnitude input
- **THEN** the form's `adjustmentPercent` is `+10` and saving persists `adjustmentPercent: 10`

#### Scenario: Maintenance forces zero magnitude

- **WHEN** the user selects the maintenance direction (with any prior magnitude)
- **THEN** the magnitude input is disabled, `adjustmentPercent` is `0`, and saving persists `adjustmentPercent: 0`

#### Scenario: Loading an existing profile restores both controls

- **WHEN** the form initializes from a saved profile with `adjustmentPercent: -20`
- **THEN** the direction control shows `deficit` and the magnitude input shows `20`

#### Scenario: Phase preset drives both controls

- **WHEN** the user selects the `fat-loss` phase preset (which sets `adjustmentPercent: -20`)
- **THEN** the direction control shows `deficit` and the magnitude input shows `20` without further interaction

#### Scenario: Out-of-range magnitude surfaces the existing range error

- **WHEN** the user enters a magnitude of `50` with the deficit direction selected
- **THEN** the form surfaces the existing `adjustmentRange` validation error (because the derived value `-50` is outside `[-40, +40]`) and does not save

#### Scenario: Mobile keyboard for magnitude is numeric

- **WHEN** the magnitude input is focused on a mobile device
- **THEN** the input declares `inputMode="numeric"` so the on-screen keyboard shows digits; no minus key is required because the magnitude is non-negative
