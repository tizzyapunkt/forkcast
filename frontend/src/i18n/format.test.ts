import { describe, expect, it } from 'vite-plus/test';
import { formatDecimal } from '../lib/decimal';
import { formatDayLabel, intlLocale, intlLocaleFor } from './format';

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
