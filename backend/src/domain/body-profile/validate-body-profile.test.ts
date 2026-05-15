import { describe, it, expect } from 'vitest';
import { validateBodyProfile, BodyProfileValidationError } from './validate-body-profile.ts';
import type { BodyProfile } from './types.ts';

const valid: BodyProfile = {
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

describe('validateBodyProfile', () => {
  it('returns the profile unchanged when all fields are valid', () => {
    expect(validateBodyProfile(valid)).toEqual(valid);
  });

  it.each([
    ['weightKg', 0],
    ['weightKg', -1],
    ['heightCm', 0],
    ['heightCm', -10],
  ])('rejects non-positive %s (%d)', (field, value) => {
    expect(() => validateBodyProfile({ ...valid, [field]: value })).toThrow(BodyProfileValidationError);
  });

  it('rejects age <= 0', () => {
    expect(() => validateBodyProfile({ ...valid, ageYears: 0 })).toThrow(BodyProfileValidationError);
    expect(() => validateBodyProfile({ ...valid, ageYears: -5 })).toThrow(BodyProfileValidationError);
  });

  it('rejects age > 120', () => {
    expect(() => validateBodyProfile({ ...valid, ageYears: 121 })).toThrow(BodyProfileValidationError);
  });

  it('rejects non-integer age', () => {
    expect(() => validateBodyProfile({ ...valid, ageYears: 30.5 })).toThrow(BodyProfileValidationError);
  });

  it.each([-41, 41, 100, -100])('rejects adjustmentPercent outside [-40, 40] (%d)', (pct) => {
    expect(() => validateBodyProfile({ ...valid, adjustmentPercent: pct })).toThrow(BodyProfileValidationError);
  });

  it.each([-40, 0, 40])('accepts adjustmentPercent at the bounds (%d)', (pct) => {
    expect(() => validateBodyProfile({ ...valid, adjustmentPercent: pct })).not.toThrow();
  });

  it('rejects non-positive proteinPerKg', () => {
    expect(() => validateBodyProfile({ ...valid, proteinPerKg: 0 })).toThrow(BodyProfileValidationError);
    expect(() => validateBodyProfile({ ...valid, proteinPerKg: -1 })).toThrow(BodyProfileValidationError);
  });

  it.each([9, 61, -5, 100])('rejects fatPercent outside [10, 60] (%d)', (pct) => {
    expect(() => validateBodyProfile({ ...valid, fatPercent: pct })).toThrow(BodyProfileValidationError);
  });

  it.each([10, 25, 60])('accepts fatPercent at the bounds (%d)', (pct) => {
    expect(() => validateBodyProfile({ ...valid, fatPercent: pct })).not.toThrow();
  });

  it('rejects non-integer fatPercent', () => {
    expect(() => validateBodyProfile({ ...valid, fatPercent: 25.5 })).toThrow(BodyProfileValidationError);
  });

  it('rejects an invalid sex value', () => {
    // @ts-expect-error — intentionally bad input
    expect(() => validateBodyProfile({ ...valid, sex: 'other' })).toThrow(BodyProfileValidationError);
  });

  it('rejects an invalid goalPhase value', () => {
    // @ts-expect-error — intentionally bad input
    expect(() => validateBodyProfile({ ...valid, goalPhase: 'bulk' })).toThrow(BodyProfileValidationError);
  });

  it('rejects an activityFactor not in the PAL set', () => {
    expect(() => validateBodyProfile({ ...valid, activityFactor: 2.5 })).toThrow(BodyProfileValidationError);
  });
});
