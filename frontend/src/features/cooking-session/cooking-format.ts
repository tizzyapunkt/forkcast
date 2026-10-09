import type { MeasurementUnit } from '../../domain/meal-log';
import type { PotRow } from '../../domain/cooking-session';
import { formatDecimal } from '../../lib/decimal';
import { t } from '../../i18n';

/** Whole numbers from 10 up, one decimal below — a pot amount is read at a glance, not weighed to the gram. */
export function formatPotAmount(value: number, unit: MeasurementUnit): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${formatDecimal(rounded)} ${t.groceryList.units[unit]}`;
}

/** The recipe's own measure for the pot amount, to the half: "4 EL", "2 Stück". */
export function formatMeasure(row: Pick<PotRow, 'potAmount' | 'measure'>): string | null {
  if (!row.measure) return null;
  const count = Math.round((row.potAmount / row.measure.perUnit) * 2) / 2;
  return `${formatDecimal(count)} ${row.measure.label}`;
}

/** "Mi · Abend" for a batch's date and slot. */
export function weekdayIndex(iso: string): number {
  const jsDay = new Date(iso + 'T00:00:00').getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}
