import type { LogEntry } from './types.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';

export interface CopyLogDayCommand {
  fromDate: string;
  toDate: string;
}

/**
 * Clone every log entry of `fromDate` onto `toDate`. Each clone gets a fresh `id` and `loggedAt`; its
 * `slot`, `ingredient`, and `recipeId` are preserved. The copy is additive — `toDate`'s existing entries
 * are left intact. Returns the created clones (empty when the source day has no entries).
 */
export async function copyLogDay(repo: LogEntryRepository, command: CopyLogDayCommand): Promise<LogEntry[]> {
  const source = await repo.findByDate(command.fromDate);
  if (source.length === 0) return [];

  const loggedAt = new Date().toISOString();
  const clones: LogEntry[] = source.map((entry) => ({
    ...entry,
    id: crypto.randomUUID(),
    date: command.toDate,
    loggedAt,
  }));

  await repo.saveMany(clones);
  return clones;
}
