## ADDED Requirements

### Requirement: Persist a body profile for the user

The system SHALL persist a single `BodyProfile` aggregate containing the user's body metrics (weight, height, age, sex), activity factor, goal phase, protein factor (g/kg), fat percent of TDEE, and calorie adjustment percentage. The profile SHALL be replaceable as a whole via an idempotent write.

#### Scenario: Saving a new body profile

- **WHEN** the user submits valid body profile data (e.g. 80 kg, 180 cm, 35 years, male, activity 1.55, phase recomposition, protein 2.0 g/kg, fat 25% of TDEE, adjustment 0%)
- **THEN** the system persists the profile so that subsequent reads return exactly those values

#### Scenario: Updating an existing body profile

- **WHEN** a body profile already exists and the user submits a new value for any field
- **THEN** the system replaces the persisted profile with the new values atomically

#### Scenario: Reading the body profile when none exists

- **WHEN** the user requests the body profile and none has been saved
- **THEN** the system returns an empty/absent result that the client can distinguish from a saved profile (it does NOT return defaults as if they were a real profile)

### Requirement: Reject invalid body profile inputs

The system SHALL reject body profile writes that contain implausible or unsafe values, returning a domain validation error.

#### Scenario: Non-positive weight or height

- **WHEN** the user submits weight ≤ 0 or height ≤ 0
- **THEN** the system rejects the write with a validation error and does not persist the profile

#### Scenario: Out-of-range age

- **WHEN** the user submits age ≤ 0 or age > 120
- **THEN** the system rejects the write with a validation error

#### Scenario: Adjustment percent outside sane bounds

- **WHEN** the user submits an `adjustmentPercent` outside [−40, +40]
- **THEN** the system rejects the write with a validation error

#### Scenario: Non-positive protein factor

- **WHEN** the user submits `proteinPerKg` ≤ 0
- **THEN** the system rejects the write with a validation error

#### Scenario: Out-of-range fat percent

- **WHEN** the user submits `fatPercent` outside [10, 60]
- **THEN** the system rejects the write with a validation error

### Requirement: Compute REE using the Ten Haaf & Weijs body-weight equation

The system SHALL compute Resting Energy Expenditure (REE, kcal/day) from the body profile using the Ten Haaf & Weijs (2014) body-weight equation, with `sex = 0` for male and `sex = 1` for female, height in meters, weight in kilograms, and age in years. The implementation SHALL be a pure function with no I/O.

#### Scenario: REE computation matches a published worked example

- **WHEN** the formula is applied to a known input set from the Ten Haaf & Weijs paper (or a peer-published verification)
- **THEN** the computed REE matches the published value within a tolerance of ±1 kcal/day

#### Scenario: Sex coding produces a higher REE for male than female at identical other inputs

- **WHEN** REE is computed for two profiles identical except `sex`
- **THEN** the male profile's REE is greater than the female profile's REE

### Requirement: Compute TDEE from REE and the activity factor

The system SHALL compute Total Daily Energy Expenditure (TDEE, kcal/day) as `REE × activityFactor`.

#### Scenario: TDEE scales linearly with the activity factor

- **WHEN** a profile has activityFactor 1.55 vs 1.725 (other fields identical)
- **THEN** the resulting TDEE values are in the ratio 1.55 : 1.725

### Requirement: Compute daily macro targets such that protein and fat stay fixed and carbs absorb the calorie adjustment

The system SHALL compute target macros from the body profile in this order:

1. `targetCalories = round(TDEE × (1 + adjustmentPercent / 100))`
2. `proteinGrams = round(proteinPerKg × weightKg)`
3. `fatGrams = round((fatPercent / 100) × TDEE / 9)` — anchored to TDEE, not target calories
4. `remainingKcal = targetCalories − proteinGrams × 4 − fatGrams × 9`
5. `carbsGrams = max(0, round(remainingKcal / 4))`

The system SHALL NOT scale protein or fat in response to an adjustment percent; only carbs change with deficit or surplus. Fat grams are derived from TDEE (a function of REE and activity factor only), independent of `adjustmentPercent`.

#### Scenario: Cutting (negative adjustment) reduces only carbs

- **WHEN** the user changes `adjustmentPercent` from 0% to −20% with all other fields fixed
- **THEN** `proteinGrams` and `fatGrams` are unchanged and `carbsGrams` decreases

#### Scenario: Surplus (positive adjustment) increases only carbs

- **WHEN** the user changes `adjustmentPercent` from 0% to +10% with all other fields fixed
- **THEN** `proteinGrams` and `fatGrams` are unchanged and `carbsGrams` increases

#### Scenario: Protein scales with body weight

- **WHEN** the user's `weightKg` increases (protein factor and adjustment fixed)
- **THEN** `proteinGrams` increases proportionally

#### Scenario: Fat scales with TDEE (weight, height, age, sex, activity), not with adjustment

- **WHEN** the user's `weightKg` increases (other inputs fixed)
- **THEN** `fatGrams` increases (because TDEE increases)

- **WHEN** the user's `adjustmentPercent` changes (other inputs fixed)
- **THEN** `fatGrams` is unchanged

### Requirement: Warn when protein and fat alone exceed the target calories

The system SHALL detect when `proteinGrams × 4 + fatGrams × 9 > targetCalories` and SHALL include a non-blocking warning flag in the computed output. Carbs SHALL be clamped to 0 (not negative). The save action SHALL NOT be blocked.

#### Scenario: Aggressive deficit triggers the warning

- **WHEN** the computed target calories are lower than the kcal contribution of the computed protein and fat
- **THEN** the computed output includes a warning flag, `carbsGrams` is 0, and the user can still save the profile or apply it as goals

#### Scenario: Normal deficit does not trigger the warning

- **WHEN** protein and fat together fit within the target calories
- **THEN** no warning flag is set

### Requirement: Phase presets pre-fill suggested factor values

The system SHALL provide phase presets with these defaults: `recomposition → { adjustmentPercent: 0, proteinPerKg: 2.0, fatPercent: 25 }`, `fat-loss → { adjustmentPercent: -20, proteinPerKg: 2.2, fatPercent: 25 }`, `gain → { adjustmentPercent: +10, proteinPerKg: 1.8, fatPercent: 25 }`. Selecting a phase in the UI SHALL pre-fill those values. The user SHALL be able to override any value after selecting a phase.

#### Scenario: Selecting fat-loss pre-fills the suggested values

- **WHEN** the user selects the `fat-loss` phase in the calculator UI
- **THEN** the form pre-fills `adjustmentPercent` to −20, `proteinPerKg` to 2.2, and `fatPercent` to 25

#### Scenario: Overriding a pre-filled value is preserved

- **WHEN** the user selects a phase and then edits one of the pre-filled fields
- **THEN** the edited value is what gets persisted, not the preset

### Requirement: Apply the computed result as the active daily nutrition goal

The system SHALL provide an action that takes the currently persisted body profile, computes target macros, and writes them into the existing `DailyGoal` storage (calories, protein, carbs, fat) as a complete replacement.

#### Scenario: Applying as goals overwrites the existing DailyGoal

- **WHEN** the user invokes "apply as goals" with a saved body profile
- **THEN** the existing `DailyGoal` is replaced with the computed `{ calories: targetCalories, protein: proteinGrams, carbs: carbsGrams, fat: fatGrams }`

#### Scenario: Applying as goals fails when no body profile is saved

- **WHEN** the user invokes "apply as goals" but no body profile has been persisted
- **THEN** the action fails with a clear error and the existing `DailyGoal` is unchanged

### Requirement: Saving the body profile does not modify the active DailyGoal

The system SHALL keep the calculator profile and the active `DailyGoal` independent: persisting changes to the body profile SHALL NOT change the active `DailyGoal` until the user explicitly applies the result as goals.

#### Scenario: Editing the profile leaves the active goal untouched

- **WHEN** the user saves a body profile (or edits an existing one) and does not invoke "apply as goals"
- **THEN** the previously active `DailyGoal` remains unchanged

### Requirement: Expose the calculator via domain-language HTTP endpoints

The system SHALL expose the body profile and apply-as-goals capabilities via HTTP endpoints that use domain language rather than generic CRUD verbs: `GET /body-profile`, `PUT /body-profile`, and `POST /body-profile/apply-as-goals`.

#### Scenario: GET returns the profile and its computed result

- **WHEN** a client sends `GET /body-profile` and a profile is saved
- **THEN** the response includes both the persisted profile fields and a `computed` block with REE, TDEE, target calories, protein/carbs/fat grams, and the warning flag

#### Scenario: PUT replaces the profile and returns the new computed result

- **WHEN** a client sends `PUT /body-profile` with a valid body
- **THEN** the response is 200 with the saved profile plus its computed result, and the active `DailyGoal` is unchanged

#### Scenario: POST /body-profile/apply-as-goals writes the DailyGoal

- **WHEN** a client sends `POST /body-profile/apply-as-goals` and a profile is saved
- **THEN** the response is 200 with the updated `DailyGoal`, and a subsequent `GET /nutrition-goal` returns those same values
