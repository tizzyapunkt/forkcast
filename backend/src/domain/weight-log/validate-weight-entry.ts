import type { WeightEntry } from './types.ts';

export class WeightEntryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeightEntryValidationError';
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateWeightEntry(input: { date: string; weightKg: number }, today: string): WeightEntry {
  if (typeof input.date !== 'string' || !DATE_PATTERN.test(input.date)) {
    throw new WeightEntryValidationError('date must match YYYY-MM-DD');
  }
  const parsed = new Date(`${input.date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.date) {
    throw new WeightEntryValidationError('date must be a real calendar date');
  }
  if (input.date > today) {
    throw new WeightEntryValidationError('date must not be in the future');
  }
  if (typeof input.weightKg !== 'number' || !Number.isFinite(input.weightKg)) {
    throw new WeightEntryValidationError('weightKg must be a finite number');
  }
  if (!(input.weightKg > 0)) {
    throw new WeightEntryValidationError('weightKg must be > 0');
  }
  if (input.weightKg > 500) {
    throw new WeightEntryValidationError('weightKg must be <= 500');
  }
  return { date: input.date, weightKg: Math.round(input.weightKg * 100) / 100 };
}
