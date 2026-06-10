import type { LogEntryRepository } from './log-entry.repository.ts';
import { getDailyLog } from './get-daily-log.use-case.ts';
import { addDaysIso } from './date-range.ts';
import type { DailyLog, DayTotals, WeekLog } from './types.ts';

const WEEK_DAYS = 7;

function sumDays(days: DailyLog[]): DayTotals {
  return days.reduce<DayTotals>(
    (acc, day) => ({
      calories: acc.calories + day.totals.calories,
      protein: acc.protein + day.totals.protein,
      carbs: acc.carbs + day.totals.carbs,
      fat: acc.fat + day.totals.fat,
      macrosPartial: acc.macrosPartial || day.totals.macrosPartial,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false },
  );
}

/**
 * Read a week of the meal log: the seven consecutive days from `startDate`, each rolled up exactly as
 * the diary's `getDailyLog`, plus the week's total and per-day averages.
 */
export async function getWeekLog(repo: LogEntryRepository, startDate: string): Promise<WeekLog> {
  const days: DailyLog[] = [];
  for (let i = 0; i < WEEK_DAYS; i++) {
    days.push(await getDailyLog(repo, addDaysIso(startDate, i)));
  }

  const totals = sumDays(days);

  return {
    startDate,
    days,
    totals,
    averages: {
      calories: totals.calories / WEEK_DAYS,
      protein: totals.protein / WEEK_DAYS,
      carbs: totals.carbs / WEEK_DAYS,
      fat: totals.fat / WEEK_DAYS,
    },
  };
}
