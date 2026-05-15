import type { BodyProfile, ComputedMacros } from '../../domain/body-profile';

/**
 * Client-side mirror of the backend Ten Haaf & Weijs (2014) body-weight REE
 * + macro algorithm. Used for live UI preview so the user sees the result
 * update as they type, without a network round-trip per keystroke.
 *
 * Must stay in sync with `backend/src/domain/body-profile/{ree,compute-macros}.ts`.
 */
export function computePreview(profile: BodyProfile): ComputedMacros {
  const heightM = profile.heightCm / 100;
  const sexCode = profile.sex === 'male' ? 0 : 1;
  const ree = 11.936 * profile.weightKg + 587.728 * heightM - 8.129 * profile.ageYears - 191.027 * sexCode + 29.279;
  const tdee = ree * profile.activityFactor;
  const targetCalories = Math.round(tdee * (1 + profile.adjustmentPercent / 100));
  const proteinGrams = Math.round(profile.proteinPerKg * profile.weightKg);
  const fatGrams = Math.round(((profile.fatPercent / 100) * tdee) / 9);
  const remainingKcal = targetCalories - proteinGrams * 4 - fatGrams * 9;
  const carbsGrams = Math.max(0, Math.round(remainingKcal / 4));
  const proteinFatExceedsTarget = remainingKcal < 0;
  return { ree, tdee, targetCalories, proteinGrams, fatGrams, carbsGrams, proteinFatExceedsTarget };
}
