import { describe, it, expect, vi } from 'vitest';
import { setNutritionGoal } from './set-nutrition-goal.use-case.ts';
import { getNutritionGoal } from './get-nutrition-goal.use-case.ts';
import type { NutritionGoalRepository } from './nutrition-goal.repository.ts';
import type { DailyGoal } from './types.ts';

const goal = { calories: 2000, protein: 150, carbs: 200, fat: 70 };

function makeRepo(stored: typeof goal | null = null): NutritionGoalRepository {
  let current = stored;
  return {
    save: vi.fn<(g: DailyGoal) => Promise<void>>().mockImplementation(async (g) => {
      current = g;
    }),
    get: vi.fn<() => Promise<DailyGoal | null>>().mockImplementation(async () => current),
  };
}

describe('setNutritionGoal', () => {
  it('persists the goal and returns it', async () => {
    const repo = makeRepo();
    const result = await setNutritionGoal(repo, goal);
    expect(result).toEqual(goal);
    expect(repo.save).toHaveBeenCalledWith(goal);
  });

  it('overwrites the existing goal', async () => {
    const repo = makeRepo({ calories: 1800, protein: 120, carbs: 180, fat: 60 });
    const updated = { calories: 2200, protein: 160, carbs: 220, fat: 80 };
    const result = await setNutritionGoal(repo, updated);
    expect(result).toEqual(updated);
    expect(repo.save).toHaveBeenCalledWith(updated);
  });
});

describe('getNutritionGoal', () => {
  it('returns the stored goal', async () => {
    const result = await getNutritionGoal(makeRepo(goal));
    expect(result).toEqual(goal);
  });

  it('returns null when no goal has been set', async () => {
    const result = await getNutritionGoal(makeRepo(null));
    expect(result).toBeNull();
  });
});
