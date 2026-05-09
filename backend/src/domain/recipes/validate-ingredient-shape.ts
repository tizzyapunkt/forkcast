import type { RecipeIngredient } from './types.ts';

const VALID_UNITS: readonly RecipeIngredient['unit'][] = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece'];

export function validateIngredientShape(ingredient: RecipeIngredient): void {
  const label = ingredient?.name ? `"${ingredient.name}"` : '(unnamed)';

  if (typeof ingredient.name !== 'string' || ingredient.name.trim().length === 0) {
    throw new Error(`Ingredient ${label}: name must be a non-empty string`);
  }
  if (!Number.isFinite(ingredient.amount) || ingredient.amount <= 0) {
    throw new Error(`Ingredient ${label}: amount must be a positive number`);
  }
  if (typeof ingredient.unit !== 'string' || !VALID_UNITS.includes(ingredient.unit)) {
    throw new Error(`Ingredient ${label}: unit must be one of ${VALID_UNITS.join(', ')}`);
  }
}
