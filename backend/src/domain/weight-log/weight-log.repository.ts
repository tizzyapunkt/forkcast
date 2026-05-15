import type { WeightEntry } from './types.ts';

export interface WeightLogRepository {
  /** Returns all entries sorted ascending by date. */
  list(): Promise<WeightEntry[]>;
  /** Idempotent upsert by `entry.date`. */
  upsert(entry: WeightEntry): Promise<void>;
  /** Idempotent remove by date (no-op when absent). */
  remove(date: string): Promise<void>;
}
