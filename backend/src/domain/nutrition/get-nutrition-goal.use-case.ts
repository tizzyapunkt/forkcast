import type { NutritionGoalRepository } from './nutrition-goal.repository.ts';
import type { DailyGoal } from './types.ts';

export async function getNutritionGoal(repo: NutritionGoalRepository): Promise<DailyGoal | null> {
  return repo.get();
}
