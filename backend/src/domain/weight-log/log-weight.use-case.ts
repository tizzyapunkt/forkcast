import type { WeightLogRepository } from './weight-log.repository.ts';
import { validateWeightEntry } from './validate-weight-entry.ts';
import { computeTrend } from './trend.ts';
import type { TrendSnapshot, WeightEntry } from './types.ts';

export interface LogWeightResult {
  entry: WeightEntry;
  trend: TrendSnapshot;
}

export async function logWeight(
  repo: WeightLogRepository,
  input: { date: string; weightKg: number },
  today: string,
): Promise<LogWeightResult> {
  const entry = validateWeightEntry(input, today);
  await repo.upsert(entry);
  const all = await repo.list();
  return { entry, trend: computeTrend(all, today) };
}
