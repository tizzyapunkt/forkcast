import type { RecipeIngredient } from './types.ts';

export function normalizeIngredient(ingredient: RecipeIngredient): RecipeIngredient {
  if (ingredient.note === undefined) return ingredient;
  const trimmed = ingredient.note.trim();
  if (trimmed === ingredient.note) return ingredient;
  return { ...ingredient, note: trimmed };
}
