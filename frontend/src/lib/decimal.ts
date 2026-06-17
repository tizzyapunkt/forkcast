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
