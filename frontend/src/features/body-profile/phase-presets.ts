import type { GoalPhase } from '../../domain/body-profile';

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
