import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LogEntry } from '../../domain/meal-log/types.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';

export class JsonLogEntryRepository implements LogEntryRepository {
  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async save(entry: LogEntry): Promise<void> {
    const entries = await this.readAll();
    entries.push(entry);
    await writeFile(this.filePath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  async findAll(): Promise<LogEntry[]> {
    return this.readAll();
  }

  async findByDate(date: string): Promise<LogEntry[]> {
    const all = await this.readAll();
    return all.filter((e) => e.date === date);
  }

  async findById(id: string): Promise<LogEntry | null> {
    const all = await this.readAll();
    return all.find((e) => e.id === id) ?? null;
  }

  async update(entry: LogEntry): Promise<void> {
    const all = await this.readAll();
    const index = all.findIndex((e) => e.id === entry.id);
    if (index === -1) throw new Error(`Log entry not found: ${entry.id}`);
    all[index] = entry;
    await writeFile(this.filePath, JSON.stringify(all, null, 2), 'utf-8');
  }

  async remove(id: string): Promise<void> {
    const all = await this.readAll();
    const filtered = all.filter((e) => e.id !== id);
    await writeFile(this.filePath, JSON.stringify(filtered, null, 2), 'utf-8');
  }

  private async readAll(): Promise<LogEntry[]> {
    if (!existsSync(this.filePath)) return [];
    const raw = await readFile(this.filePath, 'utf-8');
    return JSON.parse(raw) as LogEntry[];
  }
}
