import type { WeightLogRepository } from './weight-log.repository.ts';
import { computeTrend } from './trend.ts';
import type { TrendSnapshot } from './types.ts';

export async function getWeightTrend(repo: WeightLogRepository, asOf: string): Promise<TrendSnapshot> {
  const entries = await repo.list();
  return computeTrend(entries, asOf);
}
