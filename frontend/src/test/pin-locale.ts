// The suite asserts German copy. jsdom reports `navigator.language` as `en-US`, so without a
// stored choice the app would start in English. The setup file imports this module first,
// before any test module pulls in `i18n` and resolves the locale. The key is spelled out
// (it is `LOCALE_STORAGE_KEY`) because importing `i18n/locale` here would resolve the locale
// before the pin is written.
localStorage.setItem('forkcast:locale', 'de');
