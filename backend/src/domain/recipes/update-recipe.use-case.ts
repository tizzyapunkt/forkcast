import type { Recipe, RecipeIngredient } from './types.ts';
import type { RecipeRepository } from './recipe.repository.ts';

export interface UpdateRecipeCommand {
  id: string;
  name?: string;
  yield?: number;
  ingredients?: RecipeIngredient[];
  steps?: string[];
}

export async function updateRecipe(repo: RecipeRepository, command: UpdateRecipeCommand): Promise<Recipe> {
  const existing = await repo.findById(command.id);
  if (!existing) throw new Error(`Recipe not found: ${command.id}`);

  const next: Recipe = { ...existing };

  if (command.name !== undefined) {
    if (command.name.trim().length === 0) throw new Error('Recipe name must not be empty');
    next.name = command.name.trim();
  }
  if (command.yield !== undefined) {
    if (!Number.isFinite(command.yield) || command.yield < 1) throw new Error('Recipe yield must be >= 1');
    next.yield = command.yield;
  }
  if (command.ingredients !== undefined) {
    if (!Array.isArray(command.ingredients) || command.ingredients.length === 0) {
      throw new Error('Recipe must have at least one ingredient');
    }
    next.ingredients = command.ingredients;
  }
  if (command.steps !== undefined) {
    if (!Array.isArray(command.steps)) throw new Error('Recipe steps must be an array');
    for (const step of command.steps) {
      if (typeof step !== 'string' || step.trim().length === 0) {
        throw new Error('Recipe step must not be empty');
      }
    }
    next.steps = command.steps;
  }

  next.updatedAt = new Date().toISOString();

  await repo.update(next);
  return next;
}
