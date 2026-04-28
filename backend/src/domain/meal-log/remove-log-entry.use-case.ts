import type { LogEntryRepository } from './log-entry.repository.ts';

export async function removeLogEntry(repo: LogEntryRepository, entryId: string): Promise<void> {
  const entry = await repo.findById(entryId);
  if (!entry) throw new Error(`Log entry not found: ${entryId}`);
  await repo.remove(entryId);
}
