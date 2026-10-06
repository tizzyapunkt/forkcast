/** The UI languages forkcast ships. German is the original; English mirrors it key for key. */
export type Locale = 'de' | 'en';

export const LOCALE_STORAGE_KEY = 'forkcast:locale';

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'de' || value === 'en';
}

/**
 * The device's stored choice wins; without one, a `de*` browser language selects German and
 * anything else (or nothing) selects English.
 */
export function resolveLocale(stored: string | null, browserLanguage: string | undefined): Locale {
  if (isLocale(stored)) return stored;
  return browserLanguage?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The active locale, resolved once at startup. Switching goes through `setLocale`, which reloads. */
export const locale: Locale = resolveLocale(
  readStoredLocale(),
  typeof navigator === 'undefined' ? undefined : navigator.language,
);

/** Keeps `<html lang>` in step with the UI language, for screen readers and hyphenation. */
export function applyDocumentLanguage(l: Locale = locale, root: HTMLElement = document.documentElement): void {
  root.lang = l;
}

/**
 * Persists the choice on this device and reloads, so every module (and every cached,
 * locale-dependent query) starts fresh in the new language.
 */
export function setLocale(next: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // Storage unavailable: the reload falls back to the browser language.
  }
  location.reload();
}
