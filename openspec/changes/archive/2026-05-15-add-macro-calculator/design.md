## Context

forkcast currently stores a single `DailyGoal` aggregate (`{ calories, protein, carbs, fat }`) and exposes a manual entry form on the settings screen (`frontend/src/features/settings/nutrition-goal-form.tsx`). There is no notion of body metrics, activity level, or fitness phase — the user manually computes goals externally and types them in.

The user follows evidence-based nutrition: REE estimation via the Ten Haaf & Weijs (2014) body-weight equation, activity-factor-based TDEE, fixed protein/fat from g/kg of body weight, and carbs filling the remainder. For 90-day challenges the deficit % needs to be adjustable without re-entering every input.

## Goals / Non-Goals

**Goals:**
- Compute daily calorie + macro goals from objective body metrics and a small set of factors, using a published REE formula.
- Persist all calculator inputs so the user can revisit and tweak any single value (especially deficit %) without re-entering everything.
- Preserve protein and fat targets during deficit/surplus; only carbs absorb the calorie diff (mirrors the user's training philosophy).
- "Save as goals" writes results into the existing `DailyGoal` so the rest of the app (meal log, weekly view) keeps working unchanged.
- Keep the manual `NutritionGoalForm` available — power-user override for non-derived goals.

**Non-Goals:**
- No body-fat % or FFM-based REE variants. The body-weight Ten Haaf equation is sufficient for solo use.
- No goal periodisation, refeeds, or macro cycling. Single steady-state goal at a time.
- No historical tracking of body metrics over time — current snapshot only. (Future: weight history.)
- No automatic suggestions/coaching ("you should cut harder"). Pure calculator.
- No migration of the existing `DailyGoal` data; it stays where it is.

## Decisions

### REE formula: Ten Haaf & Weijs (2014) body-weight equation

Use the body-weight model from Ten Haaf & Weijs (PLoS ONE, 2014), which is well-validated for active adults and outperforms Mifflin-St Jeor / Harris-Benedict in athletic populations:

```
REE_kcal_per_day = 11.936 × weight_kg
                 + 587.728 × height_m
                 − 8.129 × age_years
                 − 191.027 × sex
                 + 29.279
```

Where `sex = 0` for male and `sex = 1` for female (per Ten Haaf & Weijs 2014). Because the coefficient on sex is `−191.027`, this coding yields a higher REE for males than females at otherwise identical inputs, matching biology. Unit tests pin this convention.

`TDEE = REE × PAL`.

**Alternatives considered:**
- *Mifflin-St Jeor*: more common but less accurate for athletes.
- *Ten Haaf FFM variant*: more accurate but requires body-fat % which the user does not want to estimate. Rejected.
- *Harris-Benedict*: outdated. Rejected.

### Activity factor: predefined PAL buckets

Five buckets matching the standard PAL scale: sedentary 1.2, light 1.375, moderate 1.55, very active 1.725, extreme 1.9. Stored as the numeric multiplier (not the bucket name) on the body profile, so future tweaks/customisation only change the UI.

**Alternative considered:** free numeric input — rejected; less guidance, and the buckets are well-established. Custom values can be added later if needed.

### Macro algorithm

Order of operations (deterministic, no ambiguity):

1. `REE` from Ten Haaf, `TDEE = REE × PAL`.
2. `target_calories = round(TDEE × (1 + adjustment_pct / 100))`.
3. `protein_g = round(protein_factor_g_per_kg × weight_kg)`.
4. `fat_g = round((fat_percent / 100) × TDEE / 9)` — **anchored to TDEE, not target calories**, so fat stays fixed when the user changes the deficit/surplus.
5. `remaining_kcal = target_calories − protein_g × 4 − fat_g × 9`.
6. `carbs_g = max(0, round(remaining_kcal / 4))`.
7. If `remaining_kcal < 0`, surface a non-blocking warning ("Protein + fat already exceed your target calories. Lower protein g/kg or fat % or reduce deficit."). Carbs are clamped to 0; the user can still save but the resulting kcal will be higher than the target — make this transparent in the UI by showing both "target kcal" and "actual kcal after rounding".

This guarantees the user's invariant: **protein and fat stay fixed across any deficit/surplus; carbs absorb the entire diff.**

**Why fat % is anchored to TDEE, not target calories:** if fat % were applied to `target_calories`, fat grams would drop alongside calories in a deficit, breaking the "only carbs change" rule. Anchoring to TDEE keeps fat constant across any adjustment, matching the user's training philosophy. The trade-off is that on aggressive cuts the *actual* fat % of consumed calories will be higher than the stated input (e.g. 25% of 2787 TDEE = 697 kcal of fat, but at a 20% cut target of 2230 kcal, that's actually 31% of intake). The label calls this out: "Fett (% TDEE)".

### Phase defaults (suggestions only)

Selecting a phase pre-fills these values (user can override every field):

| Phase | adjustment % | protein g/kg | fat % of TDEE |
|---|---|---|---|
| Body recomposition | 0% | 2.0 | 25 |
| Fat loss | −20% | 2.2 | 25 |
| Gain | +10% | 1.8 | 25 |

Values are constants in code, not configuration. If the user changes any field after selecting a phase, the phase stays selected but the displayed values reflect the user's overrides.

### Domain model & persistence

New aggregate `BodyProfile`:

```ts
interface BodyProfile {
  weightKg: number;        // > 0
  heightCm: number;        // > 0
  ageYears: number;        // > 0, integer
  sex: 'male' | 'female';
  activityFactor: number;  // PAL, typically 1.2..1.9
  goalPhase: 'recomposition' | 'fat-loss' | 'gain';
  proteinPerKg: number;    // g/kg, > 0
  fatPercent: number;      // % of TDEE allocated to fat, 0 < n < 100 (sane bound 10–60)
  adjustmentPercent: number; // e.g. -20, 0, 10. Bounded to e.g. [-40, +40]
}
```

Persisted as its own JSON file `./data/body-profile.json` (one file per repo is the existing convention — see `./data/nutrition-goal.json`, `./data/log-entries.json`, `./data/recipes.json`). New port `BodyProfileRepository` + `JsonBodyProfileRepository` adapter implementing `Initializable`, registered in the `bootstrap([...])` call in `index.ts`, mirroring `NutritionGoalRepository` exactly.

The macro computation lives as **pure functions** in the domain layer (no I/O, no framework imports) — heavily unit-tested. Use cases orchestrate (load profile, compute, persist DailyGoal via existing `set-nutrition-goal` use case).

**Why a separate aggregate (not embedded in `DailyGoal`):**
- `DailyGoal` semantics ("the targets the app tracks against") differ from `BodyProfile` ("the inputs that derived those targets"). Mixing them couples manual entry with calculated entry.
- The existing manual form still writes only `DailyGoal`. No data migration needed.
- Future: weight history / multiple profiles can extend `BodyProfile` without touching `DailyGoal`.

### API surface (domain language)

Following the existing pattern (`/nutrition-goal` GET/PUT):

- `GET /body-profile` — returns the persisted profile + a `computed` block (REE, TDEE, target_calories, protein_g, carbs_g, fat_g, warning flag).
- `PUT /body-profile` — replaces the profile. Returns the new profile + computed values. **Does not** touch `DailyGoal`.
- `POST /body-profile/apply-as-goals` — computes from the *current persisted profile* (no body) and writes the result into `DailyGoal` via the existing `set-nutrition-goal` use case. Returns the new `DailyGoal`.

The split between `PUT` (persist inputs, preview) and `POST /apply-as-goals` (commit to goals) lets the user adjust inputs without immediately overwriting the goal — and gives a clear "Save as goals" action in the UI.

**Alternative considered:** auto-apply on every PUT — rejected; the user may want to tweak inputs without immediately replacing tracked goals (e.g. previewing a more aggressive deficit).

### Frontend structure

New feature folder `frontend/src/features/body-profile/`:

- `body-profile-form.tsx` — the calculator form, mounted on the settings screen below the existing `NutritionGoalForm`.
- `phase-presets.ts` — phase default constants (mirrors backend).
- `compute-preview.ts` — client-side preview computation (optional, for snappy UX; canonical computation stays on the server). Could also use `useQuery` against `GET /body-profile` after every input change, but a client-side mirror is cheaper and keeps the form responsive.
- Live preview panel showing TDEE, target kcal, protein/carbs/fat in grams, and the warning if applicable.
- Two actions: "Save profile" (persists inputs, no goal change) and "Save as goals" (persists inputs **and** applies them to `DailyGoal`).

i18n: all labels and messages added to `frontend/src/i18n/de.ts` under a `bodyProfile` namespace.

### Validation rules (Zod)

- `weightKg`: positive, ≤ 300.
- `heightCm`: positive, ≤ 250.
- `ageYears`: positive integer, ≤ 120.
- `sex`: enum `'male' | 'female'`.
- `activityFactor`: one of the PAL constants.
- `goalPhase`: enum.
- `proteinPerKg`: > 0, ≤ 5.
- `fatPercent`: integer, in [10, 60] (sane bound — essential fat lower limit ~15-20%, upper ~50%).
- `adjustmentPercent`: integer, bounded to `[-40, +40]` (sanity bound — extreme deficits/surpluses are out of scope for a normal user).

## Risks / Trade-offs

- **Risk**: protein g/kg + fat % combined exceeds target calories on an aggressive cut → carbs go to zero and actual calories > target. **Mitigation**: explicit non-blocking warning + show both target and actual kcal in the preview. Don't block saving — the user knows what they're doing.
- **Risk**: Ten Haaf formula assumes adults; not valid for children/elderly extremes. **Mitigation**: age cap at 120, but no lower bound check beyond > 0. Acceptable for solo use; revisit if multi-user.
- **Risk**: sex coding wrong → systematically biased REE. The Ten Haaf & Weijs paper codes male=0, female=1; combined with the negative coefficient on sex, that yields male REE > female REE. **Mitigation**: unit test pins both the published numeric example and the male-vs-female monotonicity. Code comment cites the source.
- **Risk**: persisted profile and `DailyGoal` drift (user changes profile, forgets to "Save as goals"). **Mitigation**: UI shows "your saved profile would produce X kcal, but your active goal is Y kcal" if they diverge, with a one-click "apply as goals" button.
- **Trade-off**: client-side preview computation duplicates the formula. Worth it for UX snappiness; tests cover both paths.

## Open Questions

- None.
