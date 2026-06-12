import type { LogEntry, MealSlot } from './types.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { RecipeRepository } from '../recipes/recipe.repository.ts';

export interface LogRecipeCommand {
  recipeId: string;
  portions: number;
  date: string;
  slot: MealSlot;
}

export async function logRecipe(
  recipeRepo: RecipeRepository,
  logRepo: LogEntryRepository,
  command: LogRecipeCommand,
): Promise<LogEntry[]> {
  if (!Number.isFinite(command.portions) || command.portions <= 0) {
    throw new Error('Portions must be a positive number');
  }

  const recipe = await recipeRepo.findById(command.recipeId);
  if (!recipe) throw new Error(`Recipe not found: ${command.recipeId}`);

  const factor = command.portions / recipe.yield;
  const loggedAt = new Date().toISOString();
  // One fresh batch id per invocation — the group identity for display and batch removal.
  const recipeBatchId = crypto.randomUUID();

  const trackedIngredients = recipe.ingredients.filter((ingredient) => ingredient.untracked !== true);

  const entries: LogEntry[] = trackedIngredients.map((ingredient) => ({
    id: crypto.randomUUID(),
    date: command.date,
    slot: command.slot,
    loggedAt,
    recipeId: recipe.id,
    recipeBatchId,
    recipePortions: command.portions,
    ingredient: {
      type: 'full',
      name: ingredient.name,
      unit: ingredient.unit,
      macrosPerUnit: ingredient.macrosPerUnit,
      amount: ingredient.amount * factor,
    },
  }));

  if (entries.length === 0) return entries;

  await logRepo.saveMany(entries);
  return entries;
}
