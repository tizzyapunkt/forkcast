import type { NutritionGoalRepository } from './nutrition-goal.repository.js';
import type { DailyGoal } from './types.js';

export async function getNutritionGoal(repo: NutritionGoalRepository): Promise<DailyGoal | null> {
  return repo.get();
}
