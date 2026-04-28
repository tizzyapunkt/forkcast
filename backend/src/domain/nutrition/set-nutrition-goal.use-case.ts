import type { NutritionGoalRepository } from './nutrition-goal.repository.ts';
import type { DailyGoal } from './types.ts';

export async function setNutritionGoal(repo: NutritionGoalRepository, goal: DailyGoal): Promise<DailyGoal> {
  await repo.save(goal);
  return goal;
}
