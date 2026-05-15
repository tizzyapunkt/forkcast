import { describe, it, expect } from 'vitest';
import { computePreview } from './compute-preview';
import type { BodyProfile } from '../../domain/body-profile';

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

describe('computePreview — mirrors backend Ten Haaf & macros', () => {
  it('matches the male 80/180/30 published value within 1 kcal', () => {
    expect(computePreview(profile()).ree).toBeCloseTo(1798.2, 0);
  });

  it('matches the female 60/170/30 published value within 1 kcal', () => {
    const result = computePreview(profile({ weightKg: 60, heightCm: 170, sex: 'female' }));
    expect(result.ree).toBeCloseTo(1309.68, 0);
  });

  it('male REE is higher than female REE by 191.027 kcal at identical other inputs', () => {
    const male = computePreview(profile({ sex: 'male' }));
    const female = computePreview(profile({ sex: 'female' }));
    expect(male.ree - female.ree).toBeCloseTo(191.027, 2);
  });

  it('protein and fat unchanged by adjustment; carbs decrease in deficit', () => {
    const maintenance = computePreview(profile({ adjustmentPercent: 0 }));
    const cut = computePreview(profile({ adjustmentPercent: -20 }));
    expect(cut.proteinGrams).toBe(maintenance.proteinGrams);
    expect(cut.fatGrams).toBe(maintenance.fatGrams);
    expect(cut.carbsGrams).toBeLessThan(maintenance.carbsGrams);
  });

  it('flags proteinFatExceedsTarget and clamps carbs to 0 on aggressive deficit', () => {
    const result = computePreview(
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
    expect(result.proteinFatExceedsTarget).toBe(true);
    expect(result.carbsGrams).toBe(0);
  });

  it('fat grams unchanged when adjustmentPercent changes (anchored to TDEE)', () => {
    const maintenance = computePreview(profile({ adjustmentPercent: 0 }));
    const cut = computePreview(profile({ adjustmentPercent: -20 }));
    expect(cut.fatGrams).toBe(maintenance.fatGrams);
  });
});
