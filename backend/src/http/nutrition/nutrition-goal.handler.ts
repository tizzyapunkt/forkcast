import type { Context } from 'hono';
import { setNutritionGoal } from '../../domain/nutrition/set-nutrition-goal.use-case.ts';
import { getNutritionGoal } from '../../domain/nutrition/get-nutrition-goal.use-case.ts';
import type { NutritionGoalRepository } from '../../domain/nutrition/nutrition-goal.repository.ts';

export function makeSetNutritionGoalHandler(repo: NutritionGoalRepository) {
  return async (c: Context) => {
    const body = await c.req.json();
    const goal = await setNutritionGoal(repo, body);
    return c.json(goal);
  };
}

export function makeGetNutritionGoalHandler(repo: NutritionGoalRepository) {
  return async (c: Context) => {
    const goal = await getNutritionGoal(repo);
    if (!goal) return c.json({ error: 'No nutrition goal set' }, 404);
    return c.json(goal);
  };
}
