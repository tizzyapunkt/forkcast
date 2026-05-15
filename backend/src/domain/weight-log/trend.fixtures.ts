import type { WeightEntry } from './types.ts';

/**
 * Shared fixture corpus for `computeMovingAverage` and `computeTrend`.
 * The frontend mirrors these fixtures to guarantee the two implementations
 * never drift.
 */

function isoDateOffset(base: string, daysDelta: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysDelta);
  return d.toISOString().slice(0, 10);
}

export const ASOF = '2026-05-15';

/** 60 consecutive daily entries, slowly trending down by 0.05 kg/day. */
export const DENSE_60_DAYS: WeightEntry[] = Array.from({ length: 60 }, (_, i) => ({
  date: isoDateOffset(ASOF, -59 + i),
  weightKg: 80 - i * 0.05,
}));

/** 10 entries from the last 10 days. */
export const SPARSE_10_DAYS: WeightEntry[] = Array.from({ length: 10 }, (_, i) => ({
  date: isoDateOffset(ASOF, -9 + i),
  weightKg: 79 + (i % 2) * 0.2,
}));

/** Only 3 entries in the trailing 7-day window (insufficient → MA should be null). */
export const THREE_IN_WINDOW: WeightEntry[] = [
  { date: isoDateOffset(ASOF, -6), weightKg: 80.0 },
  { date: isoDateOffset(ASOF, -3), weightKg: 79.8 },
  { date: isoDateOffset(ASOF, 0), weightKg: 79.4 },
];

/** Four entries in the trailing window — minimum that yields a non-null MA. */
export const FOUR_IN_WINDOW: WeightEntry[] = [
  { date: isoDateOffset(ASOF, -6), weightKg: 80.0 },
  { date: isoDateOffset(ASOF, -4), weightKg: 79.8 },
  { date: isoDateOffset(ASOF, -2), weightKg: 79.5 },
  { date: isoDateOffset(ASOF, 0), weightKg: 79.4 },
];

/** Entries from a month ago, none in the trailing 7-day window. */
export const STALE_ONLY: WeightEntry[] = Array.from({ length: 7 }, (_, i) => ({
  date: isoDateOffset(ASOF, -45 + i),
  weightKg: 81 + i * 0.1,
}));

export const EMPTY_LOG: WeightEntry[] = [];

export const SINGLE_ENTRY: WeightEntry[] = [{ date: ASOF, weightKg: 78.4 }];

/**
 * 60 days of dense entries with a designed structure so worked-example
 * assertions are stable:
 *   - the 7-day window ending on `asOf` (days -6..0) averages 77.6
 *   - the 7-day window ending on `asOf - 7` (days -13..-7) averages 78.4
 *   - so weeklyRatePercent ≈ (77.6 − 78.4) / 78.4 × 100 ≈ −1.0204…
 */
export const WORKED_EXAMPLE: WeightEntry[] = (() => {
  const entries: WeightEntry[] = [];
  // Older filler (days -59..-14): roughly flat around 79.0
  for (let i = -59; i <= -14; i++) {
    entries.push({ date: isoDateOffset(ASOF, i), weightKg: 79 });
  }
  // Prior window (days -13..-7): exactly 7 entries averaging 78.4
  for (let i = -13; i <= -7; i++) {
    entries.push({ date: isoDateOffset(ASOF, i), weightKg: 78.4 });
  }
  // Trailing window (days -6..0): exactly 7 entries averaging 77.6
  for (let i = -6; i <= 0; i++) {
    entries.push({ date: isoDateOffset(ASOF, i), weightKg: 77.6 });
  }
  return entries;
})();
