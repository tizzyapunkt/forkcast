import { describe, it, expect } from 'vitest';
import { validateWeightEntry, WeightEntryValidationError } from './validate-weight-entry.ts';

const TODAY = '2026-05-15';

describe('validateWeightEntry', () => {
  it('returns a normalised entry for valid input', () => {
    expect(validateWeightEntry({ date: '2026-05-14', weightKg: 78.4 }, TODAY)).toEqual({
      date: '2026-05-14',
      weightKg: 78.4,
    });
  });

  it('rounds weightKg to two decimal places', () => {
    expect(validateWeightEntry({ date: '2026-05-14', weightKg: 78.4567 }, TODAY).weightKg).toBe(78.46);
    expect(validateWeightEntry({ date: '2026-05-14', weightKg: 78.4 }, TODAY).weightKg).toBe(78.4);
    expect(validateWeightEntry({ date: '2026-05-14', weightKg: 80 }, TODAY).weightKg).toBe(80);
  });

  it('accepts an entry dated today', () => {
    expect(validateWeightEntry({ date: TODAY, weightKg: 78.4 }, TODAY).date).toBe(TODAY);
  });

  it.each([['2026-13-40'], ['not-a-date'], ['2026-5-1'], ['2026/05/15'], ['']])(
    'rejects malformed date (%s)',
    (date) => {
      expect(() => validateWeightEntry({ date, weightKg: 78.4 }, TODAY)).toThrow(WeightEntryValidationError);
    },
  );

  it('rejects calendar-invalid dates that match the format', () => {
    expect(() => validateWeightEntry({ date: '2026-02-30', weightKg: 78.4 }, TODAY)).toThrow(
      WeightEntryValidationError,
    );
  });

  it('rejects a future date', () => {
    expect(() => validateWeightEntry({ date: '2026-05-16', weightKg: 78.4 }, TODAY)).toThrow(
      WeightEntryValidationError,
    );
  });

  it.each([0, -1, -100])('rejects non-positive weight (%d)', (weightKg) => {
    expect(() => validateWeightEntry({ date: '2026-05-14', weightKg }, TODAY)).toThrow(WeightEntryValidationError);
  });

  it.each([501, 1000, Number.POSITIVE_INFINITY])('rejects weight > 500 (%d)', (weightKg) => {
    expect(() => validateWeightEntry({ date: '2026-05-14', weightKg }, TODAY)).toThrow(WeightEntryValidationError);
  });

  it('rejects NaN weight', () => {
    expect(() => validateWeightEntry({ date: '2026-05-14', weightKg: Number.NaN }, TODAY)).toThrow(
      WeightEntryValidationError,
    );
  });
});
