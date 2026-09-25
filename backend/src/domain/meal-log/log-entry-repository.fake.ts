import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry } from './types.ts';

/** In-memory `LogEntryRepository` for use-case tests — behaves like the JSON adapter, minus the file. */
export class FakeLogEntryRepository implements LogEntryRepository {
  private entries: LogEntry[];

  constructor(entries: LogEntry[] = []) {
    this.entries = entries.map((e) => structuredClone(e));
  }

  /** Snapshot of the stored entries, for assertions. */
  all(): LogEntry[] {
    return this.entries.map((e) => structuredClone(e));
  }

  async save(entry: LogEntry): Promise<void> {
    this.entries.push(structuredClone(entry));
  }

  async saveMany(entries: LogEntry[]): Promise<void> {
    for (const e of entries) this.entries.push(structuredClone(e));
  }

  async findAll(): Promise<LogEntry[]> {
    return this.all();
  }

  async findByDate(date: string): Promise<LogEntry[]> {
    return this.all().filter((e) => e.date === date);
  }

  async findById(id: string): Promise<LogEntry | null> {
    return this.all().find((e) => e.id === id) ?? null;
  }

  async update(entry: LogEntry): Promise<void> {
    const i = this.entries.findIndex((e) => e.id === entry.id);
    if (i === -1) throw new Error(`Log entry not found: ${entry.id}`);
    this.entries[i] = structuredClone(entry);
  }

  async remove(id: string): Promise<void> {
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  async removeMany(ids: string[]): Promise<void> {
    const set = new Set(ids);
    this.entries = this.entries.filter((e) => !set.has(e.id));
  }
}
