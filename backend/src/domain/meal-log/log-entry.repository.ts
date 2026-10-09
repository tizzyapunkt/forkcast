import type { LogEntry } from './types.ts';

export interface LogEntryRepository {
  save(entry: LogEntry): Promise<void>;
  saveMany(entries: LogEntry[]): Promise<void>;
  findAll(): Promise<LogEntry[]>;
  findByDate(date: string): Promise<LogEntry[]>;
  findById(id: string): Promise<LogEntry | null>;
  update(entry: LogEntry): Promise<void>;
  remove(id: string): Promise<void>;
  /** Removes all given ids in a single atomic write — either every id is removed or none. */
  removeMany(ids: string[]): Promise<void>;
  /**
   * Removes `removeIds` and saves `entries` in a single atomic write — all of it lands or none. An entry
   * whose id is also removed replaces the stored one in place.
   */
  replaceMany(removeIds: string[], entries: LogEntry[]): Promise<void>;
}
