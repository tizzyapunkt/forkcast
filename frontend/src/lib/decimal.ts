import { intlLocale } from '../i18n/format';

// Locale-tolerant decimal handling for free-text number inputs. The browser's native
// `type="number"` only accepts a dot separator, so a German user typing "0,25" gets a
// "Gültigen Wert eingeben" rejection. We parse both separators and render values back in
// the active locale so the displayed delimiter matches what the user expects.

/**
 * Parse a user-typed decimal string, accepting either `,` or `.` as the decimal separator.
 * Returns the number, or `null` when the input is empty or not a single valid number.
 */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const normalized = trimmed.replace(/,/g, '.');
  // A single optional sign, digits, at most one dot — reject lone separators and stray chars.
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Format a number for display in an editable field using the given locale's decimal
 * separator, without thousands grouping or trailing fraction zeros.
 */
export function formatDecimal(value: number, locale: string = intlLocale): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 3,
  }).format(value);
}

/** Format a read-only number with exactly `fractionDigits` decimals in the given locale (`80,8`). */
export function formatFixed(value: number, fractionDigits: number, locale: string = intlLocale): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Like `formatFixed`, with an explicit `+`/`-` on non-zero values (`-0,76`, `+0.50`). */
export function formatSigned(value: number, fractionDigits: number, locale: string = intlLocale): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    signDisplay: 'exceptZero',
  }).format(value);
}
