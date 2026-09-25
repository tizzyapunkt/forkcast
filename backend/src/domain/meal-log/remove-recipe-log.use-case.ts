import type { LogEntryRepository } from './log-entry.repository.ts';

export interface RemoveRecipeLogCommand {
  recipeBatchId: string;
  date: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Removes every LogEntry of one recipe-log batch on one date atomically — the counterpart to
 * LogRecipe's atomic insert. Scoped to the date because days copied before copies received fresh
 * batch ids share a batch id with their source day. A batch with no entries on that date is a
 * not-found error.
 */
export async function removeRecipeLog(repo: LogEntryRepository, command: RemoveRecipeLogCommand): Promise<number> {
  const { recipeBatchId, date } = command;
  if (typeof recipeBatchId !== 'string' || recipeBatchId.trim().length === 0) {
    throw new Error('A recipe batch id is required');
  }
  if (typeof date !== 'string' || !ISO_DATE.test(date)) {
    throw new Error('A date (YYYY-MM-DD) is required');
  }

  const sameDay = await repo.findByDate(date);
  const batch = sameDay.filter((e) => e.recipeBatchId === recipeBatchId);
  if (batch.length === 0) throw new Error(`Recipe log batch not found on ${date}: ${recipeBatchId}`);

  await repo.removeMany(batch.map((e) => e.id));
  return batch.length;
}
