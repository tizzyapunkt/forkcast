import type { LogEntryRepository } from './log-entry.repository.ts';
import type { FullIngredientEntry, LogEntry } from './types.ts';
import { assertFullIngredient } from './full-ingredient.ts';

export interface AddToRecipeBatchCommand {
  recipeBatchId: string;
  date: string;
  ingredient: FullIngredientEntry;
}

/**
 * Add one ingredient to a logged recipe batch. The new entry takes slot and recipe/batch metadata from
 * the batch's entries on `date` — a batch id can recur on other dates (days copied before copies got
 * fresh ids), so the lookup is date-scoped. The recipe definition is not touched.
 */
export async function addToRecipeBatch(repo: LogEntryRepository, command: AddToRecipeBatchCommand): Promise<LogEntry> {
  if (typeof command.recipeBatchId !== 'string' || command.recipeBatchId.trim().length === 0) {
    throw new Error('A recipe batch id is required');
  }
  assertFullIngredient(command.ingredient);

  const sameDay = await repo.findByDate(command.date);
  const member = sameDay.find((e) => e.recipeBatchId === command.recipeBatchId);
  if (!member) throw new Error(`Recipe log batch not found on ${command.date}: ${command.recipeBatchId}`);

  const { type, name, unit, macrosPerUnit, amount } = command.ingredient;
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    date: member.date,
    slot: member.slot,
    loggedAt: new Date().toISOString(),
    recipeId: member.recipeId,
    recipeBatchId: member.recipeBatchId,
    recipePortions: member.recipePortions,
    ingredient: { type, name, unit, macrosPerUnit, amount },
  };

  await repo.save(entry);
  return entry;
}
