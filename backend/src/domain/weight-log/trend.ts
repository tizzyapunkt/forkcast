import type { TrendSnapshot, WeightEntry } from './types.ts';

const DAY_MS = 86_400_000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  return isoDay(new Date(d.getTime() + deltaDays * DAY_MS));
}

/**
 * Mean of all entries with `date` in the inclusive window `[asOf − windowDays + 1, asOf]`,
 * provided the window contains at least `minEntries`. Returns `null` otherwise.
 *
 * Pure and deterministic — accepts `asOf` so callers control the clock.
 */
export function computeMovingAverage(
  entries: WeightEntry[],
  asOf: string,
  windowDays = 7,
  minEntries = 4,
): number | null {
  const windowStart = shiftDays(asOf, -(windowDays - 1));
  let sum = 0;
  let count = 0;
  for (const e of entries) {
    if (e.date >= windowStart && e.date <= asOf) {
      sum += e.weightKg;
      count++;
    }
  }
  if (count < minEntries) return null;
  return sum / count;
}

function percentChange(now: number | null, baseline: number | null): number | null {
  if (now === null || baseline === null || baseline === 0) return null;
  return ((now - baseline) / baseline) * 100;
}

/**
 * Finds the earliest date `d` for which `computeMovingAverage(entries, d)` is non-null.
 * Used to anchor the "total change" indicator. Returns `null` when no window qualifies.
 */
function earliestDefinedMa(entries: WeightEntry[], windowDays: number, minEntries: number): number | null {
  if (entries.length === 0) return null;
  const sortedDates = [...new Set(entries.map((e) => e.date))].sort();
  for (const d of sortedDates) {
    const ma = computeMovingAverage(entries, d, windowDays, minEntries);
    if (ma !== null) return ma;
  }
  return null;
}

export function computeTrend(entries: WeightEntry[], asOf: string): TrendSnapshot {
  if (entries.length === 0) {
    return {
      current: null,
      movingAverage7d: null,
      weeklyRatePercent: null,
      changePercent28d: null,
      totalChangePercent: null,
      firstEntryDate: null,
      lastEntryDate: null,
      totalEntries: 0,
    };
  }

  const dates = entries.map((e) => e.date).sort();
  const firstEntryDate = dates[0]!;
  const lastEntryDate = dates[dates.length - 1]!;
  const totalEntries = entries.length;

  const current = entries.find((e) => e.date === asOf)?.weightKg ?? null;

  const ma7 = computeMovingAverage(entries, asOf);
  const maPrevWeek = computeMovingAverage(entries, shiftDays(asOf, -7));
  const ma28Ago = computeMovingAverage(entries, shiftDays(asOf, -28));
  const maFirst = earliestDefinedMa(entries, 7, 4);

  return {
    current,
    movingAverage7d: ma7,
    weeklyRatePercent: percentChange(ma7, maPrevWeek),
    changePercent28d: percentChange(ma7, ma28Ago),
    totalChangePercent: percentChange(ma7, maFirst),
    firstEntryDate,
    lastEntryDate,
    totalEntries,
  };
}
