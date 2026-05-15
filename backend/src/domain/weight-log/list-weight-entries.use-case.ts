import type { WeightLogRepository } from './weight-log.repository.ts';
import type { WeightEntry } from './types.ts';

export interface ListWeightEntriesFilter {
  from?: string;
  to?: string;
}

export async function listWeightEntries(
  repo: WeightLogRepository,
  filter: ListWeightEntriesFilter,
): Promise<WeightEntry[]> {
  const all = await repo.list();
  const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date));
  if (filter.from && filter.to && filter.from > filter.to) return [];
  return sorted.filter((e) => {
    if (filter.from && e.date < filter.from) return false;
    if (filter.to && e.date > filter.to) return false;
    return true;
  });
}
