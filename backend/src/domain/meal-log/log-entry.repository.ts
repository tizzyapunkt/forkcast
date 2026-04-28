import type { LogEntry } from './types.ts';

export interface LogEntryRepository {
  save(entry: LogEntry): Promise<void>;
  findAll(): Promise<LogEntry[]>;
  findByDate(date: string): Promise<LogEntry[]>;
  findById(id: string): Promise<LogEntry | null>;
  update(entry: LogEntry): Promise<void>;
  remove(id: string): Promise<void>;
}
