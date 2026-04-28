import type { DailyLog, LogEntry, MealSlot } from '../../domain/meal-log';
import type { DailyGoal } from '../../domain/nutrition';

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
