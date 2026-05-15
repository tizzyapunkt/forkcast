import { describe, it, expect } from 'vitest';
import { computeMacros } from './compute-macros.ts';
import { computeRee } from './ree.ts';
import type { BodyProfile } from './types.ts';

function profile(overrides: Partial<BodyProfile> = {}): BodyProfile {
  return {
    weightKg: 80,
    heightCm: 180,
    ageYears: 30,
    sex: 'male',
    activityFactor: 1.55,
    goalPhase: 'recomposition',
    proteinPerKg: 2.0,
    fatPercent: 25,
    adjustmentPercent: 0,
    ...overrides,
  };
}

describe('computeMacros — TDEE', () => {
  it('TDEE = REE × activityFactor', () => {
    const p = profile({ activityFactor: 1.55 });
    const result = computeMacros(p);
    expect(result.tdee).toBeCloseTo(computeRee(p) * 1.55, 5);
  });

  it('TDEE scales linearly with activity factor', () => {
    const a = computeMacros(profile({ activityFactor: 1.55 }));
    const b = computeMacros(profile({ activityFactor: 1.725 }));
    expect(b.tdee / a.tdee).toBeCloseTo(1.725 / 1.55, 5);
  });
});

describe('computeMacros — protein and fat invariants', () => {
  it('protein grams = round(proteinPerKg × weight); fat grams = round((fatPercent/100) × TDEE / 9)', () => {
    const p = profile({ weightKg: 80, proteinPerKg: 2.0, fatPercent: 25 });
    const result = computeMacros(p);
    expect(result.proteinGrams).toBe(160);
    // tdee ≈ 1798.2 × 1.55 = 2787.21; 25% = 696.80 kcal / 9 = 77.42 → 77 g
    expect(result.fatGrams).toBe(Math.round(((25 / 100) * result.tdee) / 9));
  });

  it('protein scales with body weight; fat scales with TDEE (not adjustment)', () => {
    const light = computeMacros(profile({ weightKg: 60 }));
    const heavy = computeMacros(profile({ weightKg: 90 }));
    expect(heavy.proteinGrams).toBeGreaterThan(light.proteinGrams);
    expect(heavy.fatGrams).toBeGreaterThan(light.fatGrams);
  });

  it('fat grams unchanged when adjustmentPercent changes (anchored to TDEE)', () => {
    const maintenance = computeMacros(profile({ adjustmentPercent: 0 }));
    const cut = computeMacros(profile({ adjustmentPercent: -20 }));
    const bulk = computeMacros(profile({ adjustmentPercent: 10 }));
    expect(cut.fatGrams).toBe(maintenance.fatGrams);
    expect(bulk.fatGrams).toBe(maintenance.fatGrams);
  });
});

describe('computeMacros — deficit and surplus only change carbs', () => {
  it('deficit (negative adjustment) reduces only carbs; protein and fat unchanged', () => {
    const maintenance = computeMacros(profile({ adjustmentPercent: 0 }));
    const cut = computeMacros(profile({ adjustmentPercent: -20 }));
    expect(cut.proteinGrams).toBe(maintenance.proteinGrams);
    expect(cut.fatGrams).toBe(maintenance.fatGrams);
    expect(cut.carbsGrams).toBeLessThan(maintenance.carbsGrams);
    expect(cut.targetCalories).toBeLessThan(maintenance.targetCalories);
  });

  it('surplus (positive adjustment) increases only carbs; protein and fat unchanged', () => {
    const maintenance = computeMacros(profile({ adjustmentPercent: 0 }));
    const bulk = computeMacros(profile({ adjustmentPercent: 10 }));
    expect(bulk.proteinGrams).toBe(maintenance.proteinGrams);
    expect(bulk.fatGrams).toBe(maintenance.fatGrams);
    expect(bulk.carbsGrams).toBeGreaterThan(maintenance.carbsGrams);
    expect(bulk.targetCalories).toBeGreaterThan(maintenance.targetCalories);
  });
});

describe('computeMacros — aggressive deficit warning', () => {
  it('flags proteinFatExceedsTarget and clamps carbs to 0 when protein+fat > target calories', () => {
    // High protein g/kg + high fat % + aggressive deficit → protein × 4 + fat × 9 > target.
    const result = computeMacros(
      profile({
        weightKg: 100,
        heightCm: 160,
        ageYears: 60,
        sex: 'female',
        activityFactor: 1.2,
        proteinPerKg: 3.0,
        fatPercent: 50,
        adjustmentPercent: -40,
      }),
    );
    const proteinKcal = result.proteinGrams * 4;
    const fatKcal = result.fatGrams * 9;
    expect(proteinKcal + fatKcal).toBeGreaterThan(result.targetCalories);
    expect(result.proteinFatExceedsTarget).toBe(true);
    expect(result.carbsGrams).toBe(0);
  });

  it('does not flag the warning for a normal deficit', () => {
    const result = computeMacros(profile({ adjustmentPercent: -20 }));
    expect(result.proteinFatExceedsTarget).toBe(false);
    expect(result.carbsGrams).toBeGreaterThan(0);
  });
});

describe('computeMacros — algorithm order matches the spec', () => {
  it('targetCalories = round(TDEE × (1 + adjustment/100)); carbs absorb the remainder', () => {
    const p = profile({ weightKg: 80, proteinPerKg: 2.0, fatPercent: 25, adjustmentPercent: -20 });
    const result = computeMacros(p);
    const expectedTarget = Math.round(result.tdee * 0.8);
    expect(result.targetCalories).toBe(expectedTarget);
    const remaining = expectedTarget - result.proteinGrams * 4 - result.fatGrams * 9;
    expect(result.carbsGrams).toBe(Math.max(0, Math.round(remaining / 4)));
  });
});
