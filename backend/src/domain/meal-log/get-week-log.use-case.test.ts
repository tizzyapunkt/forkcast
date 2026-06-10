import { describe, it, expect, vi } from 'vitest';
import { getWeekLog } from './get-week-log.use-case.ts';
import { getDailyLog } from './get-daily-log.use-case.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry, MealSlot } from './types.ts';

let idCounter = 0;

function fullEntry(date: string, slot: MealSlot, calories: number, amount = 1): LogEntry {
  return {
    id: `e-${++idCounter}`,
    date,
    slot,
    loggedAt: '2026-06-08T08:00:00.000Z',
    ingredient: {
      type: 'full',
      name: 'Food',
      unit: 'g',
      macrosPerUnit: { calories, protein: 0, carbs: 0, fat: 0 },
      amount,
    },
  };
}

function repoFor(byDate: Record<string, LogEntry[]>): LogEntryRepository {
  return {
    save: vi.fn<(entry: LogEntry) => Promise<void>>(),
    saveMany: vi.fn<(entries: LogEntry[]) => Promise<void>>(),
    findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue(Object.values(byDate).flat()),
    findByDate: vi.fn<(date: string) => Promise<LogEntry[]>>().mockImplementation(async (date) => byDate[date] ?? []),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>().mockResolvedValue(null),
    update: vi.fn<(entry: LogEntry) => Promise<void>>(),
    remove: vi.fn<(id: string) => Promise<void>>(),
  };
}

describe('getWeekLog', () => {
  it('returns exactly seven consecutive days from startDate', async () => {
    const week = await getWeekLog(repoFor({}), '2026-06-08');
    expect(week.days).toHaveLength(7);
    expect(week.days.map((d) => d.date)).toEqual([
      '2026-06-08',
      '2026-06-09',
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
      '2026-06-13',
      '2026-06-14',
    ]);
  });

  it('crosses a month boundary correctly', async () => {
    const week = await getWeekLog(repoFor({}), '2026-06-28');
    expect(week.days.map((d) => d.date)).toEqual([
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
  });

  it("each day's rollup matches getDailyLog for that date", async () => {
    const byDate = { '2026-06-09': [fullEntry('2026-06-09', 'lunch', 100, 5)] };
    const repo = repoFor(byDate);
    const week = await getWeekLog(repo, '2026-06-08');
    const monday = week.days[1]!;
    const direct = await getDailyLog(repoFor(byDate), '2026-06-09');
    expect(monday.totals).toEqual(direct.totals);
    expect(monday.totals.calories).toBe(500);
  });

  it('empty days are present with zero totals', async () => {
    const week = await getWeekLog(repoFor({}), '2026-06-08');
    for (const day of week.days) {
      expect(day.slots.map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
      expect(day.totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false });
    }
  });

  it('week aggregate is the sum of the seven days and averages are aggregate / 7', async () => {
    const byDate: Record<string, LogEntry[]> = {
      '2026-06-08': [fullEntry('2026-06-08', 'breakfast', 100, 7)], // 700
      '2026-06-10': [fullEntry('2026-06-10', 'dinner', 100, 7)], // 700
    };
    const week = await getWeekLog(repoFor(byDate), '2026-06-08');
    expect(week.totals.calories).toBe(1400);
    expect(week.averages.calories).toBe(200); // 1400 / 7
  });
});
