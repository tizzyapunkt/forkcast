import type { WeightLogRepository } from './weight-log.repository.ts';

export async function removeWeight(repo: WeightLogRepository, date: string): Promise<void> {
  await repo.remove(date);
}
