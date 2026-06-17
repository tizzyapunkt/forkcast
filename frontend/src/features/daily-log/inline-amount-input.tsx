import { useEffect, useState } from 'react';
import type { FullIngredientEntry, LogEntry } from '../../domain/meal-log';
import { de } from '../../i18n/de';
import { useEditLogEntry } from '../../queries/use-edit-log-entry';
import { parseDecimal } from '../../lib/decimal';

const DEBOUNCE_MS = 500;
const MIN_AMOUNT = 1;

type FullEntry = LogEntry & { ingredient: FullIngredientEntry };

interface InlineAmountInputProps {
  entry: FullEntry;
  /**
   * Fired with the parsed positive amount on every keystroke, or `null` when the
   * input is empty or below the minimum. Lets the parent reflect the typed amount
   * (e.g. calorie/macro readouts) before the debounced PATCH lands.
   */
  onLiveAmount?: (parsed: number | null) => void;
}

export function InlineAmountInput({ entry, onLiveAmount }: InlineAmountInputProps) {
  const { amount, unit, name } = entry.ingredient;
  const [value, setValue] = useState(String(amount));
  const { mutate } = useEditLogEntry();

  useEffect(() => {
    setValue((current) => (parseDecimal(current) === amount ? current : String(amount)));
  }, [amount]);

  useEffect(() => {
    if (!onLiveAmount) return;
    if (value.trim() === '') {
      onLiveAmount(null);
      return;
    }
    const parsed = parseDecimal(value);
    if (parsed === null || parsed < MIN_AMOUNT) {
      onLiveAmount(null);
      return;
    }
    onLiveAmount(parsed);
  }, [value, onLiveAmount]);

  useEffect(() => {
    if (value.trim() === '') return;
    const parsed = parseDecimal(value);
    if (parsed === null || parsed < MIN_AMOUNT) return;
    if (parsed === amount) return;
    const id = setTimeout(() => {
      mutate({ id: entry.id, date: entry.date, patch: { type: 'full', amount: parsed } });
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, amount, entry.id, entry.date, mutate]);

  return (
    <span className="flex items-center gap-1 text-xs">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={de.recipeIngredientEditor.amountFor(name)}
        className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-base text-muted-foreground hover:border-border focus:border-ring focus:text-foreground focus:outline-none sm:text-sm"
      />
      <span className="text-muted-foreground">{unit}</span>
    </span>
  );
}
