import type { TrendSnapshot, WeightEntry } from './weight-log';

const DAY_MS = 86_400_000;

function shiftDays(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + deltaDays * DAY_MS).toISOString().slice(0, 10);
}

export function computeMovingAverage(
  entries: WeightEntry[],
  asOf: string,
  windowDays = 7,
  minEntries = 4,
): number | null {
  const start = shiftDays(asOf, -(windowDays - 1));
  let sum = 0;
  let count = 0;
  for (const e of entries) {
    if (e.date >= start && e.date <= asOf) {
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

function earliestDefinedMa(entries: WeightEntry[], windowDays: number, minEntries: number): number | null {
  if (entries.length === 0) return null;
  const dates = [...new Set(entries.map((e) => e.date))].sort();
  for (const d of dates) {
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
  const ma7 = computeMovingAverage(entries, asOf);
  const maPrevWeek = computeMovingAverage(entries, shiftDays(asOf, -7));
  const ma28Ago = computeMovingAverage(entries, shiftDays(asOf, -28));
  const maFirst = earliestDefinedMa(entries, 7, 4);
  return {
    current: entries.find((e) => e.date === asOf)?.weightKg ?? null,
    movingAverage7d: ma7,
    weeklyRatePercent: percentChange(ma7, maPrevWeek),
    changePercent28d: percentChange(ma7, ma28Ago),
    totalChangePercent: percentChange(ma7, maFirst),
    firstEntryDate: dates[0] ?? null,
    lastEntryDate: dates[dates.length - 1] ?? null,
    totalEntries: entries.length,
  };
}
