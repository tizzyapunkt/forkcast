import { describe, expect, it } from 'vite-plus/test';
import { formatDecimal } from '../lib/decimal';
import { formatDayLabel, formatShortDate, formatWeekRange, intlLocale, intlLocaleFor } from './format';

describe('intlLocaleFor', () => {
  it('formats German as de-DE and English as en-GB', () => {
    expect(intlLocaleFor('de')).toBe('de-DE');
    expect(intlLocaleFor('en')).toBe('en-GB');
  });
});

describe('intlLocale', () => {
  it('follows the active locale (German under test)', () => {
    expect(intlLocale).toBe('de-DE');
  });
});

describe('formatDayLabel', () => {
  it('uses English weekday and month abbreviations in English', () => {
    expect(formatDayLabel('2026-10-05', 'en-GB')).toBe('Mon 5 Oct');
  });

  it('drops the comma after the German weekday', () => {
    expect(formatDayLabel('2026-10-05', 'de-DE')).toBe('Mo. 5. Okt.');
  });

  it('defaults to the active locale', () => {
    expect(formatDayLabel('2026-10-05')).toBe('Mo. 5. Okt.');
  });
});

describe('formatDecimal in the active locale', () => {
  it('renders 1.5 with a dot in English and a comma in German', () => {
    expect(formatDecimal(1.5, intlLocaleFor('en'))).toBe('1.5');
    expect(formatDecimal(1.5, intlLocaleFor('de'))).toBe('1,5');
  });

  it('defaults to the active locale rather than the browser language', () => {
    // jsdom's navigator.language is en-US; the active (pinned) locale is German.
    expect(formatDecimal(1.5)).toBe('1,5');
  });
});

describe('formatShortDate', () => {
  it('puts the day before a short month, without the German dot in English', () => {
    expect(formatShortDate('2026-10-05', 'en-GB')).toBe('5 Oct');
    expect(formatShortDate('2026-10-05', 'de-DE')).toBe('5. Okt.');
  });
});

describe('formatWeekRange', () => {
  it('names the month once when the week stays in it', () => {
    expect(formatWeekRange('2026-10-05', '2026-10-11', 'en-GB')).toMatch(/^5\s?–\s?11 October$/);
    expect(formatWeekRange('2026-10-05', '2026-10-11', 'de-DE')).toBe('5.–11. Oktober');
  });

  it('names both months when the week crosses into the next', () => {
    expect(formatWeekRange('2026-09-28', '2026-10-04', 'en-GB')).toMatch(/^28 September\s–\s4 October$/);
    expect(formatWeekRange('2026-09-28', '2026-10-04', 'de-DE')).toMatch(/^28\. September\s–\s4\. Oktober$/);
  });
});
