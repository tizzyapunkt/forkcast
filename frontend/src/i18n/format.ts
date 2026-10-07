import { type Locale, locale } from './locale';

/**
 * The `Intl` locale for a UI locale. English uses `en-GB` for its day-month order (`Mon 5 Oct`)
 * and 24-hour times, which suit a meal planner better than `en-US`.
 */
export function intlLocaleFor(l: Locale): string {
  return l === 'de' ? 'de-DE' : 'en-GB';
}

/** The `Intl` locale every date, time and number in the UI is formatted with. */
export const intlLocale = intlLocaleFor(locale);

/** A short day label for the date navigation: `Mon 5 Oct` / `Mo. 5. Okt.` (no comma after the weekday). */
export function formatDayLabel(isoDate: string, intl: string = intlLocale): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString(intl, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

/** A 24-hour clock time for log entries; the raw string when it is not a valid date. */
export function formatClockTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString(intlLocale, { hour12: false });
}

/** A day and short month for the planner's day list: `5 Oct` / `5. Okt.`. */
export function formatShortDate(isoDate: string, intl: string = intlLocale): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(intl, { day: 'numeric', month: 'short' });
}

/** A planner week: `5–11 October` / `5.–11. Oktober`, naming both months when the week crosses one. */
export function formatWeekRange(startIso: string, endIso: string, intl: string = intlLocale): string {
  return new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long' }).formatRange(
    new Date(startIso + 'T00:00:00'),
    new Date(endIso + 'T00:00:00'),
  );
}
