import type { RecipeIngredient } from './types.ts';

export const PIECE_QUANTITY_TOLERANCE = 0.05;

export function validatePieceQuantity(ingredient: RecipeIngredient): void {
  const pq = ingredient.pieceQuantity;
  if (pq === undefined) return;

  if (ingredient.unit !== 'g' && ingredient.unit !== 'ml') {
    throw new Error(
      `Ingredient "${ingredient.name}": pieceQuantity requires a mass unit (g or ml), got "${ingredient.unit}"`,
    );
  }
  if (!Number.isFinite(pq.amount) || pq.amount <= 0) {
    throw new Error(`Ingredient "${ingredient.name}": pieceQuantity.amount must be a positive number`);
  }
  if (!Number.isFinite(pq.gramsPerPiece) || pq.gramsPerPiece <= 0) {
    throw new Error(`Ingredient "${ingredient.name}": pieceQuantity.gramsPerPiece must be a positive number`);
  }
  if (typeof pq.unitLabel !== 'string' || pq.unitLabel.trim().length === 0) {
    throw new Error(`Ingredient "${ingredient.name}": pieceQuantity.unitLabel must be a non-empty string`);
  }

  const expected = pq.amount * pq.gramsPerPiece;
  const diff = Math.abs(ingredient.amount - expected);
  if (diff > expected * PIECE_QUANTITY_TOLERANCE) {
    throw new Error(
      `Ingredient "${ingredient.name}": amount ${ingredient.amount} does not match pieceQuantity ${pq.amount} × ${pq.gramsPerPiece} = ${expected} (tolerance ${PIECE_QUANTITY_TOLERANCE * 100}%)`,
    );
  }
}
