import type { LogEntry } from './types.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';

export interface CopyLogDayCommand {
  fromDate: string;
  toDate: string;
}

/**
 * Clone every log entry of `fromDate` onto `toDate`. Each clone gets a fresh `id` and `loggedAt`; its
 * `slot`, `ingredient`, `recipeId` and `recipePortions` are preserved. Each source recipe batch becomes a
 * new, independent batch: its clones share one fresh `recipeBatchId`. The copy is additive — `toDate`'s
 * existing entries are left intact. Returns the created clones (empty when the source day has none).
 */
export async function copyLogDay(repo: LogEntryRepository, command: CopyLogDayCommand): Promise<LogEntry[]> {
  const source = await repo.findByDate(command.fromDate);
  if (source.length === 0) return [];

  const loggedAt = new Date().toISOString();
  const freshBatchIds = new Map<string, string>();
  const freshBatchId = (sourceId: string): string => {
    let id = freshBatchIds.get(sourceId);
    if (!id) {
      id = crypto.randomUUID();
      freshBatchIds.set(sourceId, id);
    }
    return id;
  };

  const clones: LogEntry[] = source.map((entry) => ({
    ...entry,
    id: crypto.randomUUID(),
    date: command.toDate,
    loggedAt,
    ...(entry.recipeBatchId ? { recipeBatchId: freshBatchId(entry.recipeBatchId) } : {}),
  }));

  await repo.saveMany(clones);
  return clones;
}
