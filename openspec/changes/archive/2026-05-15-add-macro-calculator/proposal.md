## Why

Setting daily macro and calorie goals manually is error-prone and tedious. The user wants to derive goals from objective body metrics, an activity factor, and a fitness phase (body recomposition, fat loss, gain) using the Ten Haaf & Weijs (2014) body-weight REE equation. This is especially important for time-boxed challenges (e.g. 90-day fat-loss cuts) where the deficit changes over time and goals need quick, principled recomputation.

## What Changes

- Add a **macro & calorie calculator** to the settings screen.
- Collect persistent user body metrics: weight (kg), height (cm), age (years), sex (male/female).
- Collect activity factor as a predefined PAL bucket (sedentary 1.2 / light 1.375 / moderate 1.55 / very active 1.725 / extreme 1.9).
- Compute REE using **Ten Haaf & Weijs (2014) body-weight equation**, then TDEE = REE × PAL.
- Collect a **fitness goal phase** (body recomposition / fat loss / gain) with per-phase suggested defaults for protein g/kg, fat % of TDEE, and calorie adjustment %.
- Collect a **calorie adjustment %** (negative for deficit, positive for surplus). Phase defaults: recomp 0%, fat loss −20%, gain +10%.
- Compute target calories = TDEE × (1 + adjustment%/100).
- Compute protein grams = protein_factor (g/kg) × weight. Compute **fat grams = (fatPercent/100) × TDEE / 9** (anchored to TDEE, not target calories, so fat stays fixed across deficit/surplus). Compute carbs grams = (target_calories − protein × 4 − fat × 9) / 4. Carbs absorb the entire deficit/surplus — protein and fat stay fixed.
- Persist all calculator inputs alongside the resulting `DailyGoal` so the user can revisit, tweak deficit %, and recompute.
- "Save as goals" writes the computed calories/protein/carbs/fat into the existing `DailyGoal` storage, replacing whatever was there.
- Warn (non-blocking) if protein+fat alone exceed target calories (deficit too aggressive given protein/fat factors).
- Keep the existing manual `NutritionGoalForm` available as an alternative (no removal).

## Capabilities

### New Capabilities
- `macro-calculator`: derives daily calorie and macro goals from body metrics, activity factor, fitness phase, and calorie adjustment percentage using the Ten Haaf & Weijs body-weight REE formula. Persists inputs and writes results into the existing daily nutrition goal.

### Modified Capabilities
<!-- None. The existing nutrition-goal use cases have no openspec spec yet; this change only writes into their storage via the existing `set-nutrition-goal` use case. -->

## Impact

- **Backend**:
  - New domain module `backend/src/domain/body-profile/` (or similar) holding the Ten Haaf formula, PAL constants, phase defaults, and the macro computation as pure functions.
  - New persistent `BodyProfile` aggregate (weight, height, age, sex, activity factor, goal phase, protein g/kg, fat g/kg, adjustment %) stored alongside `DailyGoal` in the JSON file via a new repository port + JSON adapter.
  - New HTTP endpoints under domain language (e.g. `GET /body-profile`, `PUT /body-profile`, `POST /body-profile/apply-as-goals`) that compute and optionally persist the resulting `DailyGoal` via the existing `set-nutrition-goal` use case.
- **Frontend**:
  - New feature folder `frontend/src/features/body-profile/` with a calculator form on the settings screen (live preview of computed TDEE, calories, protein/carbs/fat in grams), phase preset selector, and "Save as goals" action.
  - New React Query hooks for fetching/updating the body profile and applying it as goals.
  - German i18n strings for all new labels and validation messages.
- **Dependencies**: none new.
- **Tests**: pure-function unit tests for the Ten Haaf formula and macro computation (including deficit/surplus edge cases and the protein+fat > target_calories warning); use-case tests for the apply-as-goals flow; component tests for the calculator form.
