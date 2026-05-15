import type { GoalPhase } from './types.ts';

export const PAL = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  veryActive: 1.725,
  extreme: 1.9,
} as const;

export const ALLOWED_ACTIVITY_FACTORS: readonly number[] = Object.values(PAL);

export interface PhasePreset {
  adjustmentPercent: number;
  proteinPerKg: number;
  fatPercent: number;
}

export const PHASE_PRESETS: Record<GoalPhase, PhasePreset> = {
  recomposition: { adjustmentPercent: 0, proteinPerKg: 2.0, fatPercent: 25 },
  'fat-loss': { adjustmentPercent: -20, proteinPerKg: 2.2, fatPercent: 25 },
  gain: { adjustmentPercent: 10, proteinPerKg: 1.8, fatPercent: 25 },
};
