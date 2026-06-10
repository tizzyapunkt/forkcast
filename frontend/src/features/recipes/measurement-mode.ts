import type { MeasurementUnit } from '../../domain/meal-log';
import type { RecipeIngredient } from '../../domain/recipes';

/** The three measurement modes a recipe ingredient row can be in. Derived from the row, never stored. */
export type MeasurementMode = 'weight' | 'piece' | 'free';

/** Grams-per-piece used when seeding piece mode on a row with no usable amount. */
export const PIECE_FALLBACK_GRAMS = 50;

/** The default piece label seeded when switching a row to piece mode. */
export const PIECE_DEFAULT_LABEL = 'Stück';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Piece quantities are only valid on mass units (g/ml). */
export function isMassUnit(unit: MeasurementUnit): boolean {
  return unit === 'g' || unit === 'ml';
}

/** Derive the active measurement mode from the row's data. */
export function modeOf(ing: RecipeIngredient): MeasurementMode {
  if (ing.pieceQuantity) return 'piece';
  if (ing.untracked) return 'free';
  return 'weight';
}

/**
 * Switch a row to a measurement mode, seeding deterministic defaults.
 * Returns the same reference when the mode already matches (no-op).
 */
export function seedMode(ing: RecipeIngredient, mode: MeasurementMode): RecipeIngredient {
  if (modeOf(ing) === mode) return ing;

  const next: RecipeIngredient = { ...ing };

  if (mode === 'weight') {
    delete next.pieceQuantity;
    delete next.untracked;
    delete next.displayQuantity;
    return next;
  }

  if (mode === 'piece') {
    delete next.untracked;
    delete next.displayQuantity;
    if (!next.pieceQuantity) {
      const gramsPerPiece = Number.isFinite(ing.amount) && ing.amount > 0 ? ing.amount : PIECE_FALLBACK_GRAMS;
      next.pieceQuantity = { amount: 1, unitLabel: PIECE_DEFAULT_LABEL, gramsPerPiece };
      next.amount = round1(gramsPerPiece);
    }
    return next;
  }

  // mode === 'free'
  delete next.pieceQuantity;
  next.untracked = true;
  return next;
}
