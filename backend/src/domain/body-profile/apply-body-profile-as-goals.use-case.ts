import type { BodyProfileRepository } from './body-profile.repository.ts';
import type { NutritionGoalRepository } from '../nutrition/nutrition-goal.repository.ts';
import type { DailyGoal } from '../nutrition/types.ts';
import { setNutritionGoal } from '../nutrition/set-nutrition-goal.use-case.ts';
import { computeMacros } from './compute-macros.ts';

export class NoBodyProfileSavedError extends Error {
  constructor() {
    super('No body profile saved');
    this.name = 'NoBodyProfileSavedError';
  }
}

export async function applyBodyProfileAsGoals(
  bodyProfileRepo: BodyProfileRepository,
  nutritionGoalRepo: NutritionGoalRepository,
): Promise<DailyGoal> {
  const profile = await bodyProfileRepo.get();
  if (!profile) throw new NoBodyProfileSavedError();
  const { targetCalories, proteinGrams, fatGrams, carbsGrams } = computeMacros(profile);
  return setNutritionGoal(nutritionGoalRepo, {
    calories: targetCalories,
    protein: proteinGrams,
    carbs: carbsGrams,
    fat: fatGrams,
  });
}
