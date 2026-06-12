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
}
