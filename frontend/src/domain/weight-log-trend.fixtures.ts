import type { WeightEntry } from './weight-log';

function isoDateOffset(base: string, daysDelta: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysDelta);
  return d.toISOString().slice(0, 10);
}

export const ASOF = '2026-05-15';

export const DENSE_60_DAYS: WeightEntry[] = Array.from({ length: 60 }, (_, i) => ({
  date: isoDateOffset(ASOF, -59 + i),
  weightKg: 80 - i * 0.05,
}));

export const SPARSE_10_DAYS: WeightEntry[] = Array.from({ length: 10 }, (_, i) => ({
  date: isoDateOffset(ASOF, -9 + i),
  weightKg: 79 + (i % 2) * 0.2,
}));

export const THREE_IN_WINDOW: WeightEntry[] = [
  { date: isoDateOffset(ASOF, -6), weightKg: 80.0 },
  { date: isoDateOffset(ASOF, -3), weightKg: 79.8 },
  { date: isoDateOffset(ASOF, 0), weightKg: 79.4 },
];

export const FOUR_IN_WINDOW: WeightEntry[] = [
  { date: isoDateOffset(ASOF, -6), weightKg: 80.0 },
  { date: isoDateOffset(ASOF, -4), weightKg: 79.8 },
  { date: isoDateOffset(ASOF, -2), weightKg: 79.5 },
  { date: isoDateOffset(ASOF, 0), weightKg: 79.4 },
];

export const STALE_ONLY: WeightEntry[] = Array.from({ length: 7 }, (_, i) => ({
  date: isoDateOffset(ASOF, -45 + i),
  weightKg: 81 + i * 0.1,
}));

export const EMPTY_LOG: WeightEntry[] = [];

export const SINGLE_ENTRY: WeightEntry[] = [{ date: ASOF, weightKg: 78.4 }];

export const WORKED_EXAMPLE: WeightEntry[] = (() => {
  const entries: WeightEntry[] = [];
  for (let i = -59; i <= -14; i++) entries.push({ date: isoDateOffset(ASOF, i), weightKg: 79 });
  for (let i = -13; i <= -7; i++) entries.push({ date: isoDateOffset(ASOF, i), weightKg: 78.4 });
  for (let i = -6; i <= 0; i++) entries.push({ date: isoDateOffset(ASOF, i), weightKg: 77.6 });
  return entries;
})();
