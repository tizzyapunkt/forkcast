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
