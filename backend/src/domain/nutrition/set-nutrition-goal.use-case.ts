import type { NutritionGoalRepository } from './nutrition-goal.repository.js';
import type { DailyGoal } from './types.js';

export async function setNutritionGoal(repo: NutritionGoalRepository, goal: DailyGoal): Promise<DailyGoal> {
  await repo.save(goal);
  return goal;
}
