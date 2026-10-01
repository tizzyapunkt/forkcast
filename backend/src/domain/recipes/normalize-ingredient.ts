import type { RecipeIngredient } from './types.ts';

export function normalizeIngredient(ingredient: RecipeIngredient): RecipeIngredient {
  const name = ingredient.name.trim();
  const note = ingredient.note?.trim();
  if (name === ingredient.name && note === ingredient.note) return ingredient;
  return { ...ingredient, name, ...(note !== undefined ? { note } : {}) };
}
