import { de } from './de';
import { en } from './en';
import type { Messages } from './messages';
import { locale } from './locale';

export { locale, setLocale, type Locale } from './locale';
export type { Messages } from './messages';

/** The active locale's UI copy. Resolved once at startup; `setLocale` reloads to switch. */
export const t: Messages = locale === 'de' ? de : en;
