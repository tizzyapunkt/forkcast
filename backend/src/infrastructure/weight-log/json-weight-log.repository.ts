import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { WeightEntry } from '../../domain/weight-log/types.ts';
import type { WeightLogRepository } from '../../domain/weight-log/weight-log.repository.ts';

export class JsonWeightLogRepository implements WeightLogRepository {
  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

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
    await writeFile(this.filePath, JSON.stringify(all, null, 2), 'utf-8');
  }

  async remove(date: string): Promise<void> {
    const all = await this.readAll();
    const next = all.filter((e) => e.date !== date);
    if (next.length === all.length) return;
    await writeFile(this.filePath, JSON.stringify(next, null, 2), 'utf-8');
  }

  private async readAll(): Promise<WeightEntry[]> {
    if (!existsSync(this.filePath)) return [];
    const raw = await readFile(this.filePath, 'utf-8');
    return JSON.parse(raw) as WeightEntry[];
  }
}
