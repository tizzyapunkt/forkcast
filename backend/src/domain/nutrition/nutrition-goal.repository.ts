import type { DailyGoal } from './types.ts';

export interface NutritionGoalRepository {
  save(goal: DailyGoal): Promise<void>;
  get(): Promise<DailyGoal | null>;
}
