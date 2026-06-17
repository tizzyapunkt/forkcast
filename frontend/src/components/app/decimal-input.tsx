import { useState, type InputHTMLAttributes } from 'react';
import { formatDecimal, parseDecimal } from '../../lib/decimal';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  /** The committed numeric value. */
  value: number;
  /** Fired with the parsed number whenever the draft parses to a valid value. */
  onValueChange: (value: number) => void;
  /** Override the locale used to render the decimal separator (defaults to the browser locale). */
  locale?: string;
};

/**
 * A locale-aware decimal text input. Unlike native `type="number"`, it accepts both `,`
 * and `.` as the decimal separator and never rejects a half-typed value: it holds a draft
 * string while the field is being edited so intermediate states like "0," survive, then
 * reformats to the committed value in the active locale on blur.
 */
export function DecimalInput({ value, onValueChange, locale, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? formatDecimal(value, locale);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
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
}
