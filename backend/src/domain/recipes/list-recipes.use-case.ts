import type { Recipe } from './types.ts';
import type { RecipeRepository } from './recipe.repository.ts';

export async function listRecipes(repo: RecipeRepository): Promise<Recipe[]> {
  const all = await repo.findAll();
  return [...all].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
