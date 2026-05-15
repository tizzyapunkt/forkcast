import { describe, it, expect } from 'vitest';
import { computeMovingAverage, computeTrend } from './weight-log-trend';
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
} from './weight-log-trend.fixtures';

describe('computeMovingAverage (frontend mirror)', () => {
  it('arithmetic mean across entries inside the window', () => {
    expect(computeMovingAverage(FOUR_IN_WINDOW, ASOF)).toBeCloseTo(79.675, 5);
  });

  it('returns null when fewer than 4 entries in window', () => {
    expect(computeMovingAverage(THREE_IN_WINDOW, ASOF)).toBeNull();
  });

  it('excludes entries outside the window', () => {
    expect(computeMovingAverage(STALE_ONLY, ASOF)).toBeNull();
  });

  it('does not depend on input ordering', () => {
    expect(computeMovingAverage([...FOUR_IN_WINDOW].reverse(), ASOF)).toBeCloseTo(79.675, 5);
  });
});

describe('computeTrend (frontend mirror)', () => {
  it('empty log → all-null + zero', () => {
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

  it('single entry → metadata only', () => {
    const r = computeTrend(SINGLE_ENTRY, ASOF);
    expect(r.totalEntries).toBe(1);
    expect(r.current).toBe(78.4);
    expect(r.movingAverage7d).toBeNull();
  });

  it('worked example weekly rate', () => {
    const r = computeTrend(WORKED_EXAMPLE, ASOF);
    expect(r.movingAverage7d).toBeCloseTo(77.6, 5);
    expect(r.weeklyRatePercent).toBeCloseTo(((77.6 - 78.4) / 78.4) * 100, 4);
  });

  it('all five numeric fields populated for a dense log', () => {
    const r = computeTrend(DENSE_60_DAYS, ASOF);
    expect(r.current).not.toBeNull();
    expect(r.movingAverage7d).not.toBeNull();
    expect(r.weeklyRatePercent).not.toBeNull();
    expect(r.changePercent28d).not.toBeNull();
    expect(r.totalChangePercent).not.toBeNull();
  });

  it('changePercent28d is null when 28-day-ago window has too few entries', () => {
    const r = computeTrend(SPARSE_10_DAYS, ASOF);
    expect(r.movingAverage7d).not.toBeNull();
    expect(r.changePercent28d).toBeNull();
  });
});
