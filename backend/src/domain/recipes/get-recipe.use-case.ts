import type { Recipe } from './types.ts';
import type { RecipeRepository } from './recipe.repository.ts';

export async function getRecipe(repo: RecipeRepository, id: string): Promise<Recipe | null> {
  return repo.findById(id);
}
