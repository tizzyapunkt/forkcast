import type { LogEntryRepository } from './log-entry.repository.ts';

/**
 * Removes every LogEntry of one recipe-log batch atomically — the counterpart to
 * LogRecipe's atomic insert. A batch id that matches no entries is a not-found error.
 */
export async function removeRecipeLog(repo: LogEntryRepository, recipeBatchId: string): Promise<number> {
  if (typeof recipeBatchId !== 'string' || recipeBatchId.trim().length === 0) {
    throw new Error('A recipe batch id is required');
  }

  const all = await repo.findAll();
  const batch = all.filter((e) => e.recipeBatchId === recipeBatchId);
  if (batch.length === 0) throw new Error(`Recipe log batch not found: ${recipeBatchId}`);

  await repo.removeMany(batch.map((e) => e.id));
  return batch.length;
}
