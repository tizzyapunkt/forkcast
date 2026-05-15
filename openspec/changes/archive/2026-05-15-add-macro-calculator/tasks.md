## 1. Backend domain — pure calculator

- [x] 1.1 Create `backend/src/domain/body-profile/types.ts` with the `BodyProfile` interface, `Sex` and `GoalPhase` unions, and a `ComputedMacros` interface (REE, TDEE, targetCalories, proteinGrams, fatGrams, carbsGrams, warning flag)
- [x] 1.2 Create `backend/src/domain/body-profile/constants.ts` with the PAL constants and the phase preset defaults from the design table
- [x] 1.3 Write failing tests in `backend/src/domain/body-profile/ree.test.ts` for the Ten Haaf & Weijs body-weight REE formula: at least two worked examples (one male, one female) verified against the source paper or a peer-published verification, and a male-vs-female monotonicity check
- [x] 1.4 Implement `computeRee(profile): number` in `backend/src/domain/body-profile/ree.ts` as a pure function; pin the sex coding (**male=0, female=1**, per Ten Haaf & Weijs 2014) with a comment citing the source; make 1.3 pass
- [x] 1.5 Write failing tests in `backend/src/domain/body-profile/compute-macros.test.ts` covering: TDEE = REE × activityFactor; deficit reduces only carbs (protein/fat unchanged); surplus increases only carbs; protein/fat scale with weight; aggressive deficit triggers the warning and clamps carbs to 0; normal deficit does not trigger the warning
- [x] 1.6 Implement `computeMacros(profile): ComputedMacros` in `backend/src/domain/body-profile/compute-macros.ts` (pure, no I/O); make 1.5 pass

## 2. Backend domain — validation, port, use cases

- [x] 2.1 Write failing tests for input validation rules (weight/height > 0, age in (0, 120], adjustmentPercent in [−40, +40], proteinPerKg/fatPerKg > 0, sex/phase enum membership)
- [x] 2.2 Implement a `validateBodyProfile(input)` pure function (or schema) that surfaces domain validation errors; make 2.1 pass
- [x] 2.3 Define the `BodyProfileRepository` port in `backend/src/domain/body-profile/body-profile.repository.ts` (mirror `NutritionGoalRepository`): `get(): Promise<BodyProfile | null>` and `save(profile): Promise<void>`
- [x] 2.4 Write failing use-case tests in `backend/src/domain/body-profile/body-profile.use-cases.test.ts` for `getBodyProfile`, `saveBodyProfile` (replaces existing), and `applyBodyProfileAsGoals` (writes computed result through the existing `setNutritionGoal` use case; fails when no profile saved)
- [x] 2.5 Implement `get-body-profile.use-case.ts`, `save-body-profile.use-case.ts`, and `apply-body-profile-as-goals.use-case.ts` following the existing nutrition-goal use-case shape; make 2.4 pass

## 3. Backend infrastructure & HTTP

- [x] 3.1 Implement `backend/src/infrastructure/body-profile/json-body-profile.repository.ts` adapter writing to its own `./data/body-profile.json` file (one-file-per-repo convention), mirroring `json-nutrition-goal.repository.ts`
- [x] 3.2 Wire the adapter into the composition root next to the nutrition-goal wiring
- [x] 3.3 Add `backend/src/http/body-profile/body-profile.handler.ts` exposing `GET /body-profile`, `PUT /body-profile`, and `POST /body-profile/apply-as-goals` (domain-language routes) using Hono; PUT returns profile + computed; GET returns saved profile + computed (or a clear absent state); POST returns the updated `DailyGoal`
- [x] 3.4 Mount the new handler in the main HTTP composition
- [x] 3.5 Add HTTP-layer tests verifying the three endpoints, including the absent-profile and aggressive-deficit-warning cases

## 4. Frontend — feature scaffolding

- [x] 4.1 Create `frontend/src/features/body-profile/` folder
- [x] 4.2 Add `phase-presets.ts` mirroring the backend phase preset constants
- [x] 4.3 Add `compute-preview.ts` — client-side pure mirror of the macro computation for live UI preview (covered by its own Vitest suite that reuses the same test cases as the backend)
- [x] 4.4 Add German i18n strings under a `bodyProfile` namespace in `frontend/src/i18n/de.ts` (form labels, phase names, activity bucket names, validation messages, warning text, action labels)

## 5. Frontend — data layer (React Query)

- [x] 5.1 Add `frontend/src/queries/use-body-profile.ts` for `GET /body-profile`
- [x] 5.2 Add `frontend/src/queries/use-save-body-profile.ts` mutation for `PUT /body-profile` with optimistic invalidation
- [x] 5.3 Add `frontend/src/queries/use-apply-body-profile-as-goals.ts` mutation for `POST /body-profile/apply-as-goals`; on success invalidate both body-profile and nutrition-goal queries

## 6. Frontend — calculator form

- [x] 6.1 Build `body-profile-form.tsx`: react-hook-form + Zod schema matching the backend validation rules; inputs for weight, height, age, sex (radio), activity factor (select with 5 PAL buckets), goal phase (select), protein g/kg, fat g/kg, adjustment %
- [x] 6.2 Implement phase preset behaviour: selecting a phase pre-fills protein/fat factors and adjustment %; subsequent manual edits override and persist
- [x] 6.3 Build a live preview panel showing TDEE, target kcal, protein/carbs/fat in grams, and the warning when applicable, using `compute-preview.ts`
- [x] 6.4 Add two actions: "Save profile" (calls save mutation only) and "Save as goals" (calls save then apply-as-goals, or apply-as-goals if no fields changed); show a divergence hint when the persisted profile would produce a goal different from the active `DailyGoal`
- [x] 6.5 Mount `body-profile-form.tsx` on `frontend/src/features/settings/settings-screen.tsx` below the existing `NutritionGoalForm` (do not remove the manual form)

## 7. Frontend — tests

- [x] 7.1 Component test for `body-profile-form.tsx`: form renders, phase preset pre-fills fields, manual override is preserved, live preview updates as the user types, warning shows on aggressive deficit
- [x] 7.2 Component test verifying "Save as goals" results in a goal update via MSW (mocked apply-as-goals endpoint)
- [x] 7.3 Component test verifying the divergence hint appears when the persisted profile's computed goal differs from the active `DailyGoal`

## 8. Smoke test & polish

- [x] 8.1 Disable HTTPS in `frontend/vite.config.ts` before starting the dev server for smoke testing (Chrome browser tools require plain HTTP)
- [x] 8.2 Run `pnpm dev`, open the settings screen in Chrome, fill in a realistic profile, verify the live preview and "Save as goals" updates the daily targets shown elsewhere in the app
- [x] 8.3 Verify the calculator survives a reload (profile persists, computed values match what was shown before reload)
- [x] 8.4 **Re-enable HTTPS in `frontend/vite.config.ts`** after smoke testing completes — do not leave SSL disabled
- [x] 8.5 Run `pnpm --filter @forkcast/backend test` and `pnpm --filter @forkcast/frontend test` — all green
