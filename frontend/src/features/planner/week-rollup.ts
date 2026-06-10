import type { DailyLog } from '../../domain/meal-log';

/** Neutral tone scale for a day's calories against the goal — never the ruled-out Alarm-Rot. */
export type DayTone = 'empty' | 'under' | 'onTarget' | 'over';

export function dayTone(kcal: number, goalKcal: number): DayTone {
  if (kcal <= 0) return 'empty';
  if (!Number.isFinite(goalKcal) || goalKcal <= 0) return 'under';
  const ratio = kcal / goalKcal;
  if (ratio > 1.08) return 'over';
  if (ratio >= 0.92) return 'onTarget';
  return 'under';
}

/** A day counts as "planned" when it has at least one logged entry in any slot. */
export function dayHasEntries(day: DailyLog): boolean {
  return day.slots.some((s) => s.entries.length > 0);
}

export function plannedDaysCount(days: DailyLog[]): number {
  return days.filter(dayHasEntries).length;
}
