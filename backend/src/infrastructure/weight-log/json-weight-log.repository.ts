import type { WeightEntry } from '../../domain/weight-log/types.ts';
import type { WeightLogRepository } from '../../domain/weight-log/weight-log.repository.ts';
import type { JsonDocument } from '../json-document/json-document.ts';

export class JsonWeightLogRepository implements WeightLogRepository {
  constructor(private readonly document: JsonDocument) {}

  async list(): Promise<WeightEntry[]> {
    return this.readAll();
  }

  async upsert(entry: WeightEntry): Promise<void> {
    const normalised: WeightEntry = {
      date: entry.date,
      weightKg: Math.round(entry.weightKg * 100) / 100,
    };
    const all = await this.readAll();
    const idx = all.findIndex((e) => e.date === normalised.date);
    if (idx >= 0) all[idx] = normalised;
    else all.push(normalised);
    all.sort((a, b) => a.date.localeCompare(b.date));
    await this.document.write(JSON.stringify(all, null, 2));
  }

  async remove(date: string): Promise<void> {
    const all = await this.readAll();
    const next = all.filter((e) => e.date !== date);
    if (next.length === all.length) return;
    await this.document.write(JSON.stringify(next, null, 2));
  }

  private async readAll(): Promise<WeightEntry[]> {
    const raw = await this.document.read();
    if (raw === null) return [];
    return JSON.parse(raw) as WeightEntry[];
  }
}
