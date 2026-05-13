import type { RecipeIngredient } from '../../domain/recipes';

export function scaleIngredient(ingredient: RecipeIngredient, factor: number): RecipeIngredient {
  if (factor === 1) return ingredient;
  const scaled: RecipeIngredient = {
    ...ingredient,
    amount: ingredient.amount * factor,
  };
  if (ingredient.pieceQuantity) {
    scaled.pieceQuantity = {
      ...ingredient.pieceQuantity,
      amount: ingredient.pieceQuantity.amount * factor,
    };
  }
  if (ingredient.displayQuantity) {
    scaled.displayQuantity = {
      ...ingredient.displayQuantity,
      amount: ingredient.displayQuantity.amount * factor,
    };
  }
  return scaled;
}

function trimTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

export function formatMassAmount(value: number): string {
  return trimTrailingZeros((Math.round(value * 10) / 10).toFixed(1));
}

export function formatPieceCount(value: number): string {
  return trimTrailingZeros((Math.round(value * 100) / 100).toFixed(2));
}
