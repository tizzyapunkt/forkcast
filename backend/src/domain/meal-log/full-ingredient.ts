import type { FullIngredientEntry, MeasurementUnit } from './types.ts';

const UNITS: readonly MeasurementUnit[] = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece'];

function isFiniteNonNegative(n: unknown): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/**
 * Guards the one ingredient shape that may join a recipe batch: a full ingredient with a name, a known
 * unit, finite macros per unit and a positive amount. Throws a validation error otherwise.
 */
export function assertFullIngredient(value: unknown): asserts value is FullIngredientEntry {
  const i = value as Partial<FullIngredientEntry> | null;
  if (!i || i.type !== 'full') throw new Error('A full ingredient is required');
  if (typeof i.name !== 'string' || i.name.trim().length === 0) throw new Error('Ingredient name is required');
  if (!UNITS.includes(i.unit as MeasurementUnit)) throw new Error(`Unknown unit: ${String(i.unit)}`);
  const m = i.macrosPerUnit;
  if (!m || ![m.calories, m.protein, m.carbs, m.fat].every(isFiniteNonNegative)) {
    throw new Error('Macros per unit must be finite, non-negative numbers');
  }
  if (typeof i.amount !== 'number' || !Number.isFinite(i.amount) || i.amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
}
