import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { LOCALE_STORAGE_KEY, applyDocumentLanguage, locale, resolveLocale, setLocale } from './locale';

describe('resolveLocale', () => {
  it('uses the stored choice over the browser language', () => {
    expect(resolveLocale('de', 'en-US')).toBe('de');
    expect(resolveLocale('en', 'de-DE')).toBe('en');
  });

  it('follows a German browser language when nothing is stored', () => {
    expect(resolveLocale(null, 'de-AT')).toBe('de');
    expect(resolveLocale(null, 'de')).toBe('de');
  });

  it('falls back to English for any other or missing browser language', () => {
    expect(resolveLocale(null, 'fr-FR')).toBe('en');
    expect(resolveLocale(null, 'en-GB')).toBe('en');
    expect(resolveLocale(null, undefined)).toBe('en');
    expect(resolveLocale(null, '')).toBe('en');
  });

  it('ignores a stored value that is not a supported locale', () => {
    expect(resolveLocale('fr', 'de-DE')).toBe('de');
    expect(resolveLocale('fr', 'en-US')).toBe('en');
  });
});

describe('locale', () => {
  it('starts in German under test, pinned by the setup file despite the en-US jsdom browser', () => {
    expect(locale).toBe('de');
  });
});

describe('applyDocumentLanguage', () => {
  it('sets the root lang attribute to the locale', () => {
    const root = document.createElement('html');
    applyDocumentLanguage('en', root);
    expect(root.getAttribute('lang')).toBe('en');
  });

  it('defaults to the active locale on the document root', () => {
    applyDocumentLanguage();
    expect(document.documentElement.getAttribute('lang')).toBe('de');
  });
});

describe('setLocale', () => {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);

  afterEach(() => {
    vi.unstubAllGlobals();
    if (stored === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
    else localStorage.setItem(LOCALE_STORAGE_KEY, stored);
  });

  it('stores the choice on the device and reloads the app', () => {
    const reload = vi.fn<() => void>();
    vi.stubGlobal('location', { ...window.location, reload });

    setLocale('en');

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(reload).toHaveBeenCalledOnce();
  });
});
