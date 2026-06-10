import type { DailyLog, DayTotals, LogEntry, MealSlot, WeekLog } from '../../domain/meal-log';
import type { DailyGoal } from '../../domain/nutrition';
import { addDays } from '../../domain/date';

export function makeGoal(overrides: Partial<DailyGoal> = {}): DailyGoal {
  return { calories: 2000, protein: 150, carbs: 200, fat: 70, ...overrides };
}

export function makeLogEntry(overrides: Partial<LogEntry> & { slot?: MealSlot } = {}): LogEntry {
  return {
    id: crypto.randomUUID(),
    date: '2026-04-20',
    slot: 'breakfast',
    loggedAt: new Date().toISOString(),
    ingredient: { type: 'quick', label: 'Coffee', calories: 5 },
    ...overrides,
  };
}

export function makeDailyLog(overrides: Partial<DailyLog> = {}): DailyLog {
  const slots: DailyLog['slots'] = ['breakfast', 'lunch', 'dinner', 'snack'].map((slot) => ({
    slot: slot as MealSlot,
    entries: [],
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false },
  }));
  return {
    date: '2026-04-20',
    slots,
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false },
    ...overrides,
  };
}

export function makeWeekLog(startDate = '2026-06-08', days?: DailyLog[]): WeekLog {
  const ds = days ?? Array.from({ length: 7 }, (_, i) => makeDailyLog({ date: addDays(startDate, i) }));
  const totals = ds.reduce<DayTotals>(
    (a, d) => ({
      calories: a.calories + d.totals.calories,
      protein: a.protein + d.totals.protein,
      carbs: a.carbs + d.totals.carbs,
      fat: a.fat + d.totals.fat,
      macrosPartial: a.macrosPartial || d.totals.macrosPartial,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false },
  );
  return {
    startDate,
    days: ds,
    totals,
    averages: {
      calories: totals.calories / 7,
      protein: totals.protein / 7,
      carbs: totals.carbs / 7,
      fat: totals.fat / 7,
    },
  };
}
