import { describe, it, expect } from 'vitest';
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

describe('computeRee — Ten Haaf & Weijs (2014) body-weight equation', () => {
  // Numeric value derived directly from the published coefficients:
  // REE = 11.936·BW + 587.728·H(m) − 8.129·age − 191.027·sex + 29.279
  // Male 80 kg, 1.80 m, 30 yr, sex=0:
  //   11.936×80 + 587.728×1.80 − 8.129×30 − 0 + 29.279 = 1798.2 kcal/day
  it('matches the published formula for a male athlete (80 kg, 180 cm, 30 yr)', () => {
    const ree = computeRee(profile({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male' }));
    expect(ree).toBeCloseTo(1798.2, 0); // ±1 kcal/day tolerance
  });

  // Female 60 kg, 1.70 m, 30 yr, sex=1:
  //   11.936×60 + 587.728×1.70 − 8.129×30 − 191.027×1 + 29.279 = 1309.68 kcal/day
  it('matches the published formula for a female athlete (60 kg, 170 cm, 30 yr)', () => {
    const ree = computeRee(profile({ weightKg: 60, heightCm: 170, ageYears: 30, sex: 'female' }));
    expect(ree).toBeCloseTo(1309.68, 0);
  });

  it('male REE is higher than female REE at otherwise identical inputs (sex coding sanity check)', () => {
    const base = { weightKg: 70, heightCm: 175, ageYears: 35 };
    const male = computeRee(profile({ ...base, sex: 'male' }));
    const female = computeRee(profile({ ...base, sex: 'female' }));
    expect(male).toBeGreaterThan(female);
    // The exact difference is the magnitude of the sex coefficient: 191.027 kcal
    expect(male - female).toBeCloseTo(191.027, 2);
  });
});
