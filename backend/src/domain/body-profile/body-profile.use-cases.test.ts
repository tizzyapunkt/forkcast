import { describe, it, expect, vi } from 'vitest';
import { getBodyProfile } from './get-body-profile.use-case.ts';
import { saveBodyProfile } from './save-body-profile.use-case.ts';
import { applyBodyProfileAsGoals, NoBodyProfileSavedError } from './apply-body-profile-as-goals.use-case.ts';
import { BodyProfileValidationError } from './validate-body-profile.ts';
import type { BodyProfileRepository } from './body-profile.repository.ts';
import type { NutritionGoalRepository } from '../nutrition/nutrition-goal.repository.ts';
import type { BodyProfile } from './types.ts';
import type { DailyGoal } from '../nutrition/types.ts';

const profile: BodyProfile = {
  weightKg: 80,
  heightCm: 180,
  ageYears: 30,
  sex: 'male',
  activityFactor: 1.55,
  goalPhase: 'recomposition',
  proteinPerKg: 2.0,
  fatPercent: 25,
  adjustmentPercent: 0,
};

function makeBodyRepo(stored: BodyProfile | null = null): BodyProfileRepository {
  let current = stored;
  return {
    get: vi.fn<() => Promise<BodyProfile | null>>().mockImplementation(async () => current),
    save: vi.fn<(p: BodyProfile) => Promise<void>>().mockImplementation(async (p) => {
      current = p;
    }),
  };
}

function makeGoalRepo(stored: DailyGoal | null = null): NutritionGoalRepository {
  let current = stored;
  return {
    get: vi.fn<() => Promise<DailyGoal | null>>().mockImplementation(async () => current),
    save: vi.fn<(g: DailyGoal) => Promise<void>>().mockImplementation(async (g) => {
      current = g;
    }),
  };
}

describe('getBodyProfile', () => {
  it('returns the profile plus computed macros when one is saved', async () => {
    const result = await getBodyProfile(makeBodyRepo(profile));
    expect(result?.profile).toEqual(profile);
    expect(result?.computed.proteinGrams).toBe(160);
    // 25% of TDEE (≈ 2787) / 9 = ~77 g
    expect(result?.computed.fatGrams).toBeGreaterThan(70);
    expect(result?.computed.fatGrams).toBeLessThan(85);
  });

  it('returns null when no profile is saved', async () => {
    expect(await getBodyProfile(makeBodyRepo(null))).toBeNull();
  });
});

describe('saveBodyProfile', () => {
  it('persists the profile and returns it with computed macros', async () => {
    const repo = makeBodyRepo();
    const result = await saveBodyProfile(repo, profile);
    expect(repo.save).toHaveBeenCalledWith(profile);
    expect(result.profile).toEqual(profile);
    expect(result.computed.targetCalories).toBeGreaterThan(0);
  });

  it('replaces an existing profile', async () => {
    const repo = makeBodyRepo(profile);
    const updated: BodyProfile = { ...profile, weightKg: 75, adjustmentPercent: -20 };
    await saveBodyProfile(repo, updated);
    expect(repo.save).toHaveBeenCalledWith(updated);
  });

  it('rejects invalid profiles without persisting', async () => {
    const repo = makeBodyRepo();
    await expect(saveBodyProfile(repo, { ...profile, weightKg: -1 })).rejects.toThrow(BodyProfileValidationError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('applyBodyProfileAsGoals', () => {
  it('writes computed macros into the daily goal and returns the new goal', async () => {
    const bodyRepo = makeBodyRepo(profile);
    const goalRepo = makeGoalRepo();
    const result = await applyBodyProfileAsGoals(bodyRepo, goalRepo);
    expect(result.protein).toBe(160);
    expect(result.fat).toBeGreaterThan(70);
    expect(result.fat).toBeLessThan(85);
    expect(result.calories).toBeGreaterThan(0);
    expect(goalRepo.save).toHaveBeenCalledWith(result);
  });

  it('throws NoBodyProfileSavedError when no profile is saved and does not touch the goal', async () => {
    const bodyRepo = makeBodyRepo(null);
    const goalRepo = makeGoalRepo({ calories: 2000, protein: 150, carbs: 200, fat: 70 });
    await expect(applyBodyProfileAsGoals(bodyRepo, goalRepo)).rejects.toThrow(NoBodyProfileSavedError);
    expect(goalRepo.save).not.toHaveBeenCalled();
  });
});
