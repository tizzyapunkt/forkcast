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
  /** % of TDEE allocated to fat. Anchored to TDEE (not target calories) so fat stays fixed across deficit/surplus. */
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
  /** True when protein × 4 + fat × 9 > targetCalories. Carbs are clamped to 0; actual kcal will exceed target. */
  proteinFatExceedsTarget: boolean;
}
