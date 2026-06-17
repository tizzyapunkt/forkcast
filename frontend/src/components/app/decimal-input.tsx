import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { formatDecimal, parseDecimal } from '../../lib/decimal';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  /** The committed numeric value, or `null`/`undefined` to render an empty field. */
  value: number | null | undefined;
  /**
   * Fired with the parsed number while the draft parses to a valid value, or `null` once the
   * field is cleared. Unparseable in-progress input (e.g. "abc") is held without firing.
   */
  onValueChange: (value: number | null) => void;
  /** Override the locale used to render the decimal separator (defaults to the browser locale). */
  locale?: string;
};

/**
 * A locale-aware decimal text input. Unlike native `type="number"`, it accepts both `,`
 * and `.` as the decimal separator and never rejects a half-typed value: it holds a draft
 * string while the field is being edited so intermediate states like "0," survive, then
 * reformats to the committed value in the active locale on blur.
 */
export const DecimalInput = forwardRef<HTMLInputElement, Props>(function DecimalInput(
  { value, onValueChange, locale, onBlur, ...rest },
  ref,
) {
  const [draft, setDraft] = useState<string | null>(null);
  const formatted =
    value === null || value === undefined || !Number.isFinite(value) ? '' : formatDecimal(value, locale);
  const display = draft ?? formatted;

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === '') {
          onValueChange(null);
          return;
        }
        const parsed = parseDecimal(raw);
        if (parsed !== null) onValueChange(parsed);
      }}
      onBlur={(e) => {
        // Drop the draft so the field snaps back to the canonical, locale-formatted value.
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
});
