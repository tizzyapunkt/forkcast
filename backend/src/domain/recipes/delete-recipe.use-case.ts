import type { RecipeRepository } from './recipe.repository.ts';

export async function deleteRecipe(repo: RecipeRepository, id: string): Promise<void> {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Recipe not found: ${id}`);
  await repo.remove(id);
}
