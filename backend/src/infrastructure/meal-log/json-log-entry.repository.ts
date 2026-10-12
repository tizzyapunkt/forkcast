import type { LogEntry } from '../../domain/meal-log/types.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';
import type { JsonDocument } from '../json-document/json-document.ts';

export class JsonLogEntryRepository implements LogEntryRepository {
  constructor(private readonly document: JsonDocument) {}

  async save(entry: LogEntry): Promise<void> {
    const entries = await this.readAll();
    entries.push(entry);
    await this.document.write(JSON.stringify(entries, null, 2));
  }

  async saveMany(toSave: LogEntry[]): Promise<void> {
    if (toSave.length === 0) return;
    const entries = await this.readAll();
    entries.push(...toSave);
    await this.document.write(JSON.stringify(entries, null, 2));
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
    await this.document.write(JSON.stringify(all, null, 2));
  }

  async remove(id: string): Promise<void> {
    const all = await this.readAll();
    const filtered = all.filter((e) => e.id !== id);
    await this.document.write(JSON.stringify(filtered, null, 2));
  }

  async removeMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const drop = new Set(ids);
    const all = await this.readAll();
    const filtered = all.filter((e) => !drop.has(e.id));
    await this.document.write(JSON.stringify(filtered, null, 2));
  }

  async replaceMany(removeIds: string[], entries: LogEntry[]): Promise<void> {
    if (removeIds.length === 0 && entries.length === 0) return;
    await this.document.write(JSON.stringify(replaced(await this.readAll(), removeIds, entries), null, 2));
  }

  private async readAll(): Promise<LogEntry[]> {
    const raw = await this.document.read();
    if (raw === null) return [];
    return JSON.parse(raw) as LogEntry[];
  }
}

/** `all` minus `removeIds`, with `entries` taking the place of a removed id or appended. */
function replaced(all: LogEntry[], removeIds: string[], entries: LogEntry[]): LogEntry[] {
  const drop = new Set(removeIds);
  const incoming = new Map(entries.map((e) => [e.id, e]));
  const result: LogEntry[] = [];
  for (const e of all) {
    const replacement = incoming.get(e.id);
    if (replacement) {
      result.push(replacement);
      incoming.delete(e.id);
    } else if (!drop.has(e.id)) {
      result.push(e);
    }
  }
  return [...result, ...incoming.values()];
}
