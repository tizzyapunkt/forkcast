import type { Context } from 'hono';
import type { BodyProfileRepository } from '../../domain/body-profile/body-profile.repository.ts';
import type { NutritionGoalRepository } from '../../domain/nutrition/nutrition-goal.repository.ts';
import { getBodyProfile } from '../../domain/body-profile/get-body-profile.use-case.ts';
import { saveBodyProfile } from '../../domain/body-profile/save-body-profile.use-case.ts';
import {
  applyBodyProfileAsGoals,
  NoBodyProfileSavedError,
} from '../../domain/body-profile/apply-body-profile-as-goals.use-case.ts';
import { BodyProfileValidationError } from '../../domain/body-profile/validate-body-profile.ts';

export function makeGetBodyProfileHandler(repo: BodyProfileRepository) {
  return async (c: Context) => {
    const result = await getBodyProfile(repo);
    if (!result) return c.json({ error: 'No body profile saved' }, 404);
    return c.json(result);
  };
}

export function makeSaveBodyProfileHandler(repo: BodyProfileRepository) {
  return async (c: Context) => {
    const body = await c.req.json();
    try {
      const result = await saveBodyProfile(repo, body);
      return c.json(result);
    } catch (err) {
      if (err instanceof BodyProfileValidationError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  };
}

export function makeApplyBodyProfileAsGoalsHandler(bodyRepo: BodyProfileRepository, goalRepo: NutritionGoalRepository) {
  return async (c: Context) => {
    try {
      const goal = await applyBodyProfileAsGoals(bodyRepo, goalRepo);
      return c.json(goal);
    } catch (err) {
      if (err instanceof NoBodyProfileSavedError) {
        return c.json({ error: err.message }, 409);
      }
      throw err;
    }
  };
}
