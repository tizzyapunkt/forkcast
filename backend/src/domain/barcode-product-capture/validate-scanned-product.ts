import type { SaveScannedProductInput, ScannedProduct } from './types.ts';

export type InputValidationResult = { ok: true; value: SaveScannedProductInput } | { ok: false; reason: string };

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/**
 * Validates the client-supplied fields of a product to save: a non-empty
 * barcode and name, a `g`/`ml` unit, and four finite, non-negative per-100
 * macro values. `capturedAt` is set by the store, not the client.
 */
export function validateScannedProductInput(value: unknown): InputValidationResult {
  if (!value || typeof value !== 'object') {
    return { ok: false, reason: 'product must be an object' };
  }
  const v = value as Record<string, unknown>;
  if (typeof v.barcode !== 'string' || v.barcode.trim().length === 0) {
    return { ok: false, reason: 'barcode missing or empty' };
  }
  if (typeof v.name !== 'string' || v.name.trim().length === 0) {
    return { ok: false, reason: 'name missing or empty' };
  }
  if (v.unit !== 'g' && v.unit !== 'ml') {
    return { ok: false, reason: 'unit must be "g" or "ml"' };
  }
  const m = v.macrosPer100;
  if (!m || typeof m !== 'object') {
    return { ok: false, reason: 'macrosPer100 missing' };
  }
  const macros = m as Record<string, unknown>;
  if (
    !isFiniteNonNegative(macros.calories) ||
    !isFiniteNonNegative(macros.protein) ||
    !isFiniteNonNegative(macros.carbs) ||
    !isFiniteNonNegative(macros.fat)
  ) {
    return { ok: false, reason: 'macrosPer100 calories/protein/carbs/fat must be finite non-negative numbers' };
  }
  return {
    ok: true,
    value: {
      barcode: v.barcode.trim(),
      name: v.name.trim(),
      unit: v.unit,
      macrosPer100: {
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      },
    },
  };
}

export type ValidationResult = { ok: true; product: ScannedProduct } | { ok: false; reason: string };

/** Validates a full stored product (input fields + an ISO `capturedAt`); used when loading the store. */
export function validateScannedProduct(value: unknown): ValidationResult {
  const input = validateScannedProductInput(value);
  if (!input.ok) return input;
  const capturedAt = (value as Record<string, unknown>).capturedAt;
  if (typeof capturedAt !== 'string' || capturedAt.trim().length === 0) {
    return { ok: false, reason: `product ${input.value.barcode}: capturedAt missing or empty` };
  }
  return { ok: true, product: { ...input.value, capturedAt } };
}
