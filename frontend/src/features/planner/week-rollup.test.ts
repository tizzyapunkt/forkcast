import { describe, expect, it } from 'vitest';
import type { DailyLog, LogEntry, MealSlot, SlotSummary } from '../../domain/meal-log';
import { dayHasEntries, dayTone, plannedDaysCount } from './week-rollup';

const zero = { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false };

function entry(): LogEntry {
  return {
    id: 'e',
    date: '2026-06-08',
    slot: 'breakfast',
    loggedAt: '',
    ingredient: { type: 'quick', label: 'x', calories: 100 },
  };
}

function day(entriesInBreakfast: number): DailyLog {
  const slots: SlotSummary[] = (['breakfast', 'lunch', 'dinner', 'snack'] as MealSlot[]).map((slot) => ({
    slot,
    entries: slot === 'breakfast' ? Array.from({ length: entriesInBreakfast }, entry) : [],
    totals: zero,
  }));
  return { date: '2026-06-08', slots, totals: zero };
}

describe('dayTone (Neutral scale)', () => {
  it('is empty at zero kcal', () => {
    expect(dayTone(0, 2000)).toBe('empty');
  });
  it('is onTarget within ±8% of the goal', () => {
    expect(dayTone(2000, 2000)).toBe('onTarget');
    expect(dayTone(1850, 2000)).toBe('onTarget'); // 0.925
  });
  it('is under when well below the goal', () => {
    expect(dayTone(1000, 2000)).toBe('under');
  });
  it('is over when more than 8% above the goal', () => {
    expect(dayTone(2200, 2000)).toBe('over'); // 1.1
  });
  it('treats a non-positive goal as under (never crashes)', () => {
    expect(dayTone(500, 0)).toBe('under');
  });
});

describe('plannedDaysCount / dayHasEntries', () => {
  it('counts only days with at least one entry', () => {
    const days = [day(0), day(2), day(0), day(1)];
    expect(plannedDaysCount(days)).toBe(2);
    expect(dayHasEntries(day(0))).toBe(false);
    expect(dayHasEntries(day(1))).toBe(true);
  });
});
