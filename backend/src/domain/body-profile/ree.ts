import type { BodyProfile } from './types.ts';

/**
 * Resting Energy Expenditure (kcal/day) per Ten Haaf & Weijs (2014):
 *   REE = 11.936·BW(kg) + 587.728·H(m) − 8.129·age − 191.027·sex + 29.279
 *
 * Sex coding per the source paper: sex = 0 for male, sex = 1 for female.
 * Combined with the negative coefficient on sex, this yields a higher REE for
 * males than females at identical other inputs — matching biology.
 *
 * Source: Ten Haaf T, Weijs PJM. "Resting Energy Expenditure Prediction in
 * Recreational Athletes of 18–35 Years: Confirmation of Cunningham Equation
 * and an Improved Weight-Based Alternative." PLoS ONE 9(9): e108460 (2014).
 */
export function computeRee(profile: BodyProfile): number {
  const heightM = profile.heightCm / 100;
  const sexCode = profile.sex === 'male' ? 0 : 1;
  return 11.936 * profile.weightKg + 587.728 * heightM - 8.129 * profile.ageYears - 191.027 * sexCode + 29.279;
}
