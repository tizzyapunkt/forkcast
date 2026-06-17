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
export function formatDecimal(value: number, locale: string = navigator.language): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 3,
  }).format(value);
}

/**
 * `setValueAs` adapter for a required react-hook-form number field. Normalizes the raw
 * input (which may carry a locale comma) to a number, or `NaN` when empty/invalid so the
 * zod `.number()` rejects it.
 */
export function toDecimalValue(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  return parseDecimal(typeof raw === 'string' ? raw : String(raw ?? '')) ?? NaN;
}

/**
 * `setValueAs` adapter for an optional react-hook-form number field. An empty input stays
 * an empty string so the schema's existing empty-handling is unchanged; otherwise it parses
 * the locale-aware decimal (or `NaN` when invalid).
 */
export function toOptionalDecimalValue(raw: unknown): number | '' {
  if (typeof raw === 'number') return raw;
  const s = typeof raw === 'string' ? raw : String(raw ?? '');
  if (s.trim() === '') return '';
  return parseDecimal(s) ?? NaN;
}
