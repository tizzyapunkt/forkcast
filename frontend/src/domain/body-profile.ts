export type Sex = 'male' | 'female';
export type GoalPhase = 'recomposition' | 'fat-loss' | 'gain';

export interface BodyProfile {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activityFactor: number;
  goalPhase: GoalPhase;
  proteinPerKg: number;
  fatPercent: number;
  adjustmentPercent: number;
}

export interface ComputedMacros {
  ree: number;
  tdee: number;
  targetCalories: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  proteinFatExceedsTarget: boolean;
}

export interface BodyProfileWithComputed {
  profile: BodyProfile;
  computed: ComputedMacros;
}

export const PAL = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  veryActive: 1.725,
  extreme: 1.9,
} as const;

export const ACTIVITY_FACTORS: readonly number[] = Object.values(PAL);
