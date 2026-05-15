import { computeRee } from './ree.ts';
import type { BodyProfile, ComputedMacros } from './types.ts';

/**
 * Computes daily calorie and macro targets from a body profile.
 *
 * Algorithm (deterministic, in order):
 *   1. REE from Ten Haaf & Weijs (2014).
 *   2. TDEE = REE × activityFactor.
 *   3. targetCalories = round(TDEE × (1 + adjustmentPercent / 100)).
 *   4. proteinGrams = round(proteinPerKg × weightKg).
 *   5. fatGrams    = round((fatPercent / 100) × TDEE / 9).   // anchored to TDEE, not target
 *   6. carbsGrams  = max(0, round((targetCalories − protein·4 − fat·9) / 4)).
 *   7. proteinFatExceedsTarget when protein·4 + fat·9 > targetCalories.
 *
 * Invariant: protein is derived from body weight alone; fat is derived from
 * TDEE (weight × height × age × sex × activity), never from `adjustmentPercent`.
 * Deficit/surplus shifts only carbs.
 */
export function computeMacros(profile: BodyProfile): ComputedMacros {
  const ree = computeRee(profile);
  const tdee = ree * profile.activityFactor;
  const targetCalories = Math.round(tdee * (1 + profile.adjustmentPercent / 100));
  const proteinGrams = Math.round(profile.proteinPerKg * profile.weightKg);
  const fatGrams = Math.round(((profile.fatPercent / 100) * tdee) / 9);
  const remainingKcal = targetCalories - proteinGrams * 4 - fatGrams * 9;
  const carbsGrams = Math.max(0, Math.round(remainingKcal / 4));
  const proteinFatExceedsTarget = remainingKcal < 0;
  return { ree, tdee, targetCalories, proteinGrams, fatGrams, carbsGrams, proteinFatExceedsTarget };
}
