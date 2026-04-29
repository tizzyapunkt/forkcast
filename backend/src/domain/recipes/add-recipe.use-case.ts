import type { Recipe, RecipeIngredient } from './types.ts';
import type { RecipeRepository } from './recipe.repository.ts';

export interface AddRecipeCommand {
  name: string;
  yield: number;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export async function addRecipe(repo: RecipeRepository, command: AddRecipeCommand): Promise<Recipe> {
  validate(command);

  const now = new Date().toISOString();
  const recipe: Recipe = {
    id: crypto.randomUUID(),
    name: command.name.trim(),
    yield: command.yield,
    ingredients: command.ingredients,
    steps: command.steps,
    createdAt: now,
    updatedAt: now,
  };

  await repo.save(recipe);
  return recipe;
}

function validate(command: AddRecipeCommand): void {
  if (!command.name || command.name.trim().length === 0) {
    throw new Error('Recipe name must not be empty');
  }
  if (!Number.isFinite(command.yield) || command.yield < 1) {
    throw new Error('Recipe yield must be >= 1');
  }
  if (!Array.isArray(command.ingredients) || command.ingredients.length === 0) {
    throw new Error('Recipe must have at least one ingredient');
  }
  if (!Array.isArray(command.steps)) {
    throw new Error('Recipe steps must be an array');
  }
  for (const step of command.steps) {
    if (typeof step !== 'string' || step.trim().length === 0) {
      throw new Error('Recipe step must not be empty');
    }
  }
}
