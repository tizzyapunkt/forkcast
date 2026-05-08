import type { RecipeIngredient } from './recipes';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scaleIngredients(ingredients: RecipeIngredient[], factor: number): RecipeIngredient[] {
  if (!Number.isFinite(factor) || factor <= 0) return ingredients;
  return ingredients.map((ing) => {
    const scaledAmount = round1(ing.amount * factor);
    if (!ing.pieceQuantity) {
      return { ...ing, amount: scaledAmount };
    }
    return {
      ...ing,
      amount: scaledAmount,
      pieceQuantity: {
        ...ing.pieceQuantity,
        amount: round1(ing.pieceQuantity.amount * factor),
      },
    };
  });
}
