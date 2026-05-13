import type { RecipeIngredient } from './recipes';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scaleIngredients(ingredients: RecipeIngredient[], factor: number): RecipeIngredient[] {
  if (!Number.isFinite(factor) || factor <= 0) return ingredients;
  return ingredients.map((ing) => {
    const scaledAmount = round1(ing.amount * factor);
    const next: RecipeIngredient = { ...ing, amount: scaledAmount };
    if (ing.pieceQuantity) {
      next.pieceQuantity = {
        ...ing.pieceQuantity,
        amount: round1(ing.pieceQuantity.amount * factor),
      };
    }
    if (ing.displayQuantity) {
      next.displayQuantity = {
        ...ing.displayQuantity,
        amount: round1(ing.displayQuantity.amount * factor),
      };
    }
    return next;
  });
}
