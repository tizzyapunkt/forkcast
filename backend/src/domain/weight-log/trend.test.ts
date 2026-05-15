import { describe, it, expect } from 'vitest';
import { computeMovingAverage, computeTrend } from './trend.ts';
import {
  ASOF,
  DENSE_60_DAYS,
  EMPTY_LOG,
  FOUR_IN_WINDOW,
  SINGLE_ENTRY,
  SPARSE_10_DAYS,
  STALE_ONLY,
  THREE_IN_WINDOW,
  WORKED_EXAMPLE,
} from './trend.fixtures.ts';

describe('computeMovingAverage', () => {
  it('returns the arithmetic mean across entries inside the window', () => {
    // FOUR_IN_WINDOW: 80.0, 79.8, 79.5, 79.4 → mean 79.675
    expect(computeMovingAverage(FOUR_IN_WINDOW, ASOF)).toBeCloseTo(79.675, 5);
  });

  it('returns null when fewer than 4 entries fall in the window', () => {
    expect(computeMovingAverage(THREE_IN_WINDOW, ASOF)).toBeNull();
  });

  it('excludes entries dated before the window start', () => {
    // STALE_ONLY has entries 45 days ago; trailing window has none.
    expect(computeMovingAverage(STALE_ONLY, ASOF)).toBeNull();
  });

  it('excludes entries dated after the window end (asOf)', () => {
    // Construct a log where only future-of-asOf entries exist.
    const futureOnly = [
      { date: '2026-05-16', weightKg: 79 },
      { date: '2026-05-17', weightKg: 79 },
      { date: '2026-05-18', weightKg: 79 },
      { date: '2026-05-19', weightKg: 79 },
    ];
    expect(computeMovingAverage(futureOnly, ASOF)).toBeNull();
  });

  it('does not depend on input ordering', () => {
    const shuffled = [...FOUR_IN_WINDOW].reverse();
    expect(computeMovingAverage(shuffled, ASOF)).toBeCloseTo(computeMovingAverage(FOUR_IN_WINDOW, ASOF) as number, 10);
  });

  it('honours custom window size and min-entries threshold', () => {
    // FOUR_IN_WINDOW spans 6 days; a 3-day window catches the last two entries only (insufficient @ minEntries=4).
    expect(computeMovingAverage(FOUR_IN_WINDOW, ASOF, 3, 4)).toBeNull();
    // Drop the threshold to 2 → the same two-entry mean is returned.
    expect(computeMovingAverage(FOUR_IN_WINDOW, ASOF, 3, 2)).toBeCloseTo((79.5 + 79.4) / 2, 5);
  });
});

describe('computeTrend — empty + sparse cases', () => {
  it('returns all-null fields and zero totals for an empty log', () => {
    expect(computeTrend(EMPTY_LOG, ASOF)).toEqual({
      current: null,
      movingAverage7d: null,
      weeklyRatePercent: null,
      changePercent28d: null,
      totalChangePercent: null,
      firstEntryDate: null,
      lastEntryDate: null,
      totalEntries: 0,
    });
  });

  it('returns metadata but null trends for a single-entry log', () => {
    const result = computeTrend(SINGLE_ENTRY, ASOF);
    expect(result.totalEntries).toBe(1);
    expect(result.firstEntryDate).toBe(ASOF);
    expect(result.lastEntryDate).toBe(ASOF);
    expect(result.current).toBe(78.4);
    expect(result.movingAverage7d).toBeNull();
    expect(result.weeklyRatePercent).toBeNull();
    expect(result.changePercent28d).toBeNull();
    expect(result.totalChangePercent).toBeNull();
  });

  it('returns all-null trends when the trailing 7-day window has only 3 entries', () => {
    const result = computeTrend(THREE_IN_WINDOW, ASOF);
    expect(result.movingAverage7d).toBeNull();
    expect(result.weeklyRatePercent).toBeNull();
    expect(result.changePercent28d).toBeNull();
    expect(result.totalChangePercent).toBeNull();
  });
});

describe('computeTrend — worked examples', () => {
  it('weeklyRatePercent: trailing MA 77.6 vs prior MA 78.4 → ≈ −1.0204 %', () => {
    const result = computeTrend(WORKED_EXAMPLE, ASOF);
    expect(result.movingAverage7d).toBeCloseTo(77.6, 5);
    expect(result.weeklyRatePercent).toBeCloseTo(((77.6 - 78.4) / 78.4) * 100, 4);
  });

  it('all five numeric fields are populated when history is dense', () => {
    const result = computeTrend(DENSE_60_DAYS, ASOF);
    expect(result.current).not.toBeNull();
    expect(result.movingAverage7d).not.toBeNull();
    expect(result.weeklyRatePercent).not.toBeNull();
    expect(result.changePercent28d).not.toBeNull();
    expect(result.totalChangePercent).not.toBeNull();
  });

  it('current reflects the raw weight on asOf when an entry exists', () => {
    const result = computeTrend(DENSE_60_DAYS, ASOF);
    // DENSE_60_DAYS last entry: i=59 → weight 80 - 59*0.05 = 77.05
    expect(result.current).toBeCloseTo(77.05, 5);
  });

  it('current is null when no entry exists on asOf', () => {
    const noToday = DENSE_60_DAYS.slice(0, -1); // drop the last entry (the asOf one)
    expect(computeTrend(noToday, ASOF).current).toBeNull();
  });

  it('reports correct metadata', () => {
    const result = computeTrend(DENSE_60_DAYS, ASOF);
    expect(result.totalEntries).toBe(60);
    expect(result.firstEntryDate).toBe(DENSE_60_DAYS[0]!.date);
    expect(result.lastEntryDate).toBe(DENSE_60_DAYS[DENSE_60_DAYS.length - 1]!.date);
  });
});

describe('computeTrend — partial history', () => {
  it('changePercent28d is null when the 28-day-ago window has too few entries', () => {
    // SPARSE_10_DAYS only has entries in the last 10 days → window at asOf-28 is empty.
    const result = computeTrend(SPARSE_10_DAYS, ASOF);
    expect(result.movingAverage7d).not.toBeNull();
    expect(result.changePercent28d).toBeNull();
  });

  it('totalChangePercent is anchored to the earliest 7-day window with a defined MA', () => {
    const result = computeTrend(WORKED_EXAMPLE, ASOF);
    // WORKED_EXAMPLE's earliest dense window averages 79.0 (the day-by-day filler)
    // total = (77.6 − 79.0) / 79.0 × 100
    expect(result.totalChangePercent).toBeCloseTo(((77.6 - 79.0) / 79.0) * 100, 4);
  });
});
