import { describe, it, expect, vi } from 'vitest';
import { getDailyLog } from './get-daily-log.use-case.js';
import type { LogEntryRepository } from './log-entry.repository.js';
import type { LogEntry, MacrosPer100, MealSlot } from './types.js';

let idCounter = 0;

function makeFullEntry(slot: MealSlot, macrosPerUnit: MacrosPer100, amount: number): LogEntry {
  return {
    id: `entry-${++idCounter}`,
    date: '2026-04-19',
    slot,
    loggedAt: new Date().toISOString(),
    ingredient: { type: 'full', name: 'Food', unit: 'g', macrosPerUnit, amount },
  };
}

function makeQuickEntry(
  slot: MealSlot,
  values: { calories: number; protein?: number; carbs?: number; fat?: number },
): LogEntry {
  return {
    id: `entry-${++idCounter}`,
    date: '2026-04-19',
    slot,
    loggedAt: new Date().toISOString(),
    ingredient: { type: 'quick', label: 'Quick food', ...values },
  };
}

function makeRepo(entries: LogEntry[]): LogEntryRepository {
  return {
    save: vi.fn<(entry: LogEntry) => Promise<void>>(),
    findByDate: vi.fn<(date: string) => Promise<LogEntry[]>>().mockResolvedValue(entries),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>().mockResolvedValue(null),
    update: vi.fn<(entry: LogEntry) => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe('getDailyLog', () => {
  it('returns all four slots with zero totals when no entries exist', async () => {
    const result = await getDailyLog(makeRepo([]), '2026-04-19');

    expect(result.date).toBe('2026-04-19');
    expect(result.slots.map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(result.totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false });
  });

  it('calculates totals for a full ingredient entry (macrosPerUnit × amount)', async () => {
    const result = await getDailyLog(
      makeRepo([makeFullEntry('breakfast', { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 }, 200)]),
      '2026-04-19',
    );

    expect(result.totals.calories).toBeCloseTo(330);
    expect(result.totals.protein).toBeCloseTo(62);
    expect(result.totals.carbs).toBeCloseTo(0);
    expect(result.totals.fat).toBeCloseTo(7.2);
    expect(result.totals.macrosPartial).toBe(false);
  });

  it('uses quick entry values directly', async () => {
    const result = await getDailyLog(
      makeRepo([makeQuickEntry('snack', { calories: 200, protein: 20, carbs: 15, fat: 7 })]),
      '2026-04-19',
    );

    expect(result.totals.calories).toBe(200);
    expect(result.totals.protein).toBe(20);
    expect(result.totals.carbs).toBe(15);
    expect(result.totals.fat).toBe(7);
  });

  it('flags macros_partial when a quick entry has no macro breakdown', async () => {
    const result = await getDailyLog(makeRepo([makeQuickEntry('breakfast', { calories: 300 })]), '2026-04-19');

    expect(result.totals.macrosPartial).toBe(true);
    expect(result.totals.calories).toBe(300);
  });

  it('does not flag macros_partial when all entries have full macro data', async () => {
    const result = await getDailyLog(
      makeRepo([
        makeQuickEntry('breakfast', { calories: 200, protein: 20, carbs: 15, fat: 7 }),
        makeFullEntry('lunch', { calories: 2, protein: 0.3, carbs: 0.2, fat: 0.05 }, 150),
      ]),
      '2026-04-19',
    );

    expect(result.totals.macrosPartial).toBe(false);
  });

  it('groups entries into the correct slot', async () => {
    const result = await getDailyLog(
      makeRepo([
        makeFullEntry('breakfast', { calories: 1, protein: 0.1, carbs: 0.1, fat: 0.01 }, 100),
        makeFullEntry('lunch', { calories: 2, protein: 0.2, carbs: 0.2, fat: 0.02 }, 100),
      ]),
      '2026-04-19',
    );

    const breakfast = result.slots.find((s) => s.slot === 'breakfast')!;
    const lunch = result.slots.find((s) => s.slot === 'lunch')!;
    const dinner = result.slots.find((s) => s.slot === 'dinner')!;

    expect(breakfast.entries).toHaveLength(1);
    expect(lunch.entries).toHaveLength(1);
    expect(dinner.entries).toHaveLength(0);
    expect(breakfast.totals.calories).toBeCloseTo(100);
    expect(lunch.totals.calories).toBeCloseTo(200);
  });

  it('sums totals across all slots', async () => {
    const result = await getDailyLog(
      makeRepo([
        makeFullEntry('breakfast', { calories: 1, protein: 0.1, carbs: 0.1, fat: 0.01 }, 100),
        makeFullEntry('dinner', { calories: 3, protein: 0.3, carbs: 0.3, fat: 0.03 }, 100),
      ]),
      '2026-04-19',
    );

    expect(result.totals.calories).toBeCloseTo(400);
    expect(result.totals.protein).toBeCloseTo(40);
  });
});
