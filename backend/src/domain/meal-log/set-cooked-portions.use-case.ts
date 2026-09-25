import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry } from './types.ts';

export interface SetCookedPortionsCommand {
  recipeBatchId: string;
  date: string;
  cookedPortions: number;
}

/**
 * Record how many portions of a logged recipe batch are cooked — for the grocery list, never for
 * nutrition. Written onto every entry of the batch on `date` so the batch always agrees with itself.
 * Cooking fewer portions than were logged as eaten (leftovers) is not modelled yet, so the logged
 * portions are the minimum.
 */
export async function setCookedPortions(
  repo: LogEntryRepository,
  command: SetCookedPortionsCommand,
): Promise<LogEntry[]> {
  const { recipeBatchId, date, cookedPortions } = command;
  if (typeof recipeBatchId !== 'string' || recipeBatchId.trim().length === 0) {
    throw new Error('A recipe batch id is required');
  }

  const batch = (await repo.findByDate(date)).filter((e) => e.recipeBatchId === recipeBatchId);
  if (batch.length === 0) throw new Error(`Recipe log batch not found on ${date}: ${recipeBatchId}`);

  const logged = batch[0]?.recipePortions ?? 1;
  if (typeof cookedPortions !== 'number' || !Number.isFinite(cookedPortions) || cookedPortions < logged) {
    throw new Error(`Cooked portions must be a number of at least ${logged} (the logged portions)`);
  }

  const updated = batch.map((e) => ({ ...e, cookedPortions }));
  for (const e of updated) await repo.update(e);
  return updated;
}
