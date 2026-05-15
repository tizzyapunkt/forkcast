import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import {
  makeGetBodyProfileHandler,
  makeSaveBodyProfileHandler,
  makeApplyBodyProfileAsGoalsHandler,
} from './body-profile.handler.ts';
import type { BodyProfileRepository } from '../../domain/body-profile/body-profile.repository.ts';
import type { NutritionGoalRepository } from '../../domain/nutrition/nutrition-goal.repository.ts';
import type { BodyProfile } from '../../domain/body-profile/types.ts';
import type { DailyGoal } from '../../domain/nutrition/types.ts';

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

function makeGoalRepo(): NutritionGoalRepository {
  let current: DailyGoal | null = null;
  return {
    get: vi.fn<() => Promise<DailyGoal | null>>().mockImplementation(async () => current),
    save: vi.fn<(g: DailyGoal) => Promise<void>>().mockImplementation(async (g) => {
      current = g;
    }),
  };
}

function makeApp(bodyRepo: BodyProfileRepository, goalRepo: NutritionGoalRepository) {
  const app = new Hono();
  app.get('/body-profile', makeGetBodyProfileHandler(bodyRepo));
  app.put('/body-profile', makeSaveBodyProfileHandler(bodyRepo));
  app.post('/body-profile/apply-as-goals', makeApplyBodyProfileAsGoalsHandler(bodyRepo, goalRepo));
  return app;
}

describe('GET /body-profile', () => {
  it('returns 404 when no profile is saved', async () => {
    const app = makeApp(makeBodyRepo(null), makeGoalRepo());
    const res = await app.request('/body-profile');
    expect(res.status).toBe(404);
  });

  it('returns the saved profile plus computed macros', async () => {
    const app = makeApp(makeBodyRepo(profile), makeGoalRepo());
    const res = await app.request('/body-profile');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      profile: BodyProfile;
      computed: { proteinGrams: number; fatGrams: number; targetCalories: number; proteinFatExceedsTarget: boolean };
    };
    expect(body.profile).toEqual(profile);
    expect(body.computed.proteinGrams).toBe(160);
    expect(body.computed.targetCalories).toBeGreaterThan(0);
    expect(body.computed.proteinFatExceedsTarget).toBe(false);
    // 25% of TDEE / 9 → ~77 g
    expect(body.computed.fatGrams).toBeGreaterThan(70);
    expect(body.computed.fatGrams).toBeLessThan(85);
  });
});

describe('PUT /body-profile', () => {
  it('saves a valid profile and returns the new profile + computed result; does not touch the goal', async () => {
    const bodyRepo = makeBodyRepo();
    const goalRepo = makeGoalRepo();
    const res = await makeApp(bodyRepo, goalRepo).request('/body-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    expect(res.status).toBe(200);
    expect(bodyRepo.save).toHaveBeenCalledWith(profile);
    expect(goalRepo.save).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid input and does not persist', async () => {
    const bodyRepo = makeBodyRepo();
    const goalRepo = makeGoalRepo();
    const res = await makeApp(bodyRepo, goalRepo).request('/body-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, weightKg: -1 }),
    });
    expect(res.status).toBe(400);
    expect(bodyRepo.save).not.toHaveBeenCalled();
  });

  it('returns the aggressive-deficit warning in computed when applicable', async () => {
    const bodyRepo = makeBodyRepo();
    const goalRepo = makeGoalRepo();
    const aggressive: BodyProfile = {
      ...profile,
      weightKg: 100,
      heightCm: 160,
      ageYears: 60,
      sex: 'female',
      activityFactor: 1.2,
      proteinPerKg: 3.0,
      fatPercent: 50,
      adjustmentPercent: -40,
    };
    const res = await makeApp(bodyRepo, goalRepo).request('/body-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aggressive),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { computed: { proteinFatExceedsTarget: boolean; carbsGrams: number } };
    expect(body.computed.proteinFatExceedsTarget).toBe(true);
    expect(body.computed.carbsGrams).toBe(0);
  });
});

describe('POST /body-profile/apply-as-goals', () => {
  it('writes the computed result into the daily goal and returns it', async () => {
    const goalRepo = makeGoalRepo();
    const res = await makeApp(makeBodyRepo(profile), goalRepo).request('/body-profile/apply-as-goals', {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DailyGoal;
    expect(body.protein).toBe(160);
    expect(body.fat).toBeGreaterThan(70);
    expect(body.fat).toBeLessThan(85);
    expect(goalRepo.save).toHaveBeenCalledWith(body);
  });

  it('returns 409 when no profile is saved and does not touch the goal', async () => {
    const goalRepo = makeGoalRepo();
    const res = await makeApp(makeBodyRepo(null), goalRepo).request('/body-profile/apply-as-goals', {
      method: 'POST',
    });
    expect(res.status).toBe(409);
    expect(goalRepo.save).not.toHaveBeenCalled();
  });
});
