import type { DailyGoal } from './types.js';

export interface NutritionGoalRepository {
  save(goal: DailyGoal): Promise<void>;
  get(): Promise<DailyGoal | null>;
}
