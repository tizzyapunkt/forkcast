import type { LogEntryRepository } from './log-entry.repository.ts';
import type { FullIngredientEntry, LogEntry } from './types.ts';
import { assertFullIngredient } from './full-ingredient.ts';

export interface ReplaceBatchIngredientCommand {
  entryId: string;
  ingredient: FullIngredientEntry;
}

/**
 * Swap the food of one entry inside a logged recipe batch. The entry keeps its id, date, slot and batch
 * link, so it stays in the meal; the recipe definition is not touched. `loggedAt` is refreshed so the
 * new food surfaces as recently used.
 */
export async function replaceBatchIngredient(
  repo: LogEntryRepository,
  command: ReplaceBatchIngredientCommand,
): Promise<LogEntry> {
  assertFullIngredient(command.ingredient);

  const entry = await repo.findById(command.entryId);
  if (!entry) throw new Error(`Log entry not found: ${command.entryId}`);
  if (!entry.recipeBatchId) throw new Error('Only entries of a recipe batch can have their ingredient replaced');

  const { type, name, unit, macrosPerUnit, amount } = command.ingredient;
  const updated: LogEntry = {
    ...entry,
    loggedAt: new Date().toISOString(),
    ingredient: { type, name, unit, macrosPerUnit, amount },
  };

  await repo.update(updated);
  return updated;
}
