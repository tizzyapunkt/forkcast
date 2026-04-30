import { useEffect, useState } from 'react';
import type { FullIngredientEntry, LogEntry } from '../../domain/meal-log';
import { de } from '../../i18n/de';
import { useEditLogEntry } from '../../queries/use-edit-log-entry';

const DEBOUNCE_MS = 500;
const MIN_AMOUNT = 1;

type FullEntry = LogEntry & { ingredient: FullIngredientEntry };

interface InlineAmountInputProps {
  entry: FullEntry;
}

export function InlineAmountInput({ entry }: InlineAmountInputProps) {
  const { amount, unit, name } = entry.ingredient;
  const [value, setValue] = useState(String(amount));
  const { mutate } = useEditLogEntry();

  useEffect(() => {
    setValue((current) => (Number(current) === amount ? current : String(amount)));
  }, [amount]);

  useEffect(() => {
    if (value.trim() === '') return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < MIN_AMOUNT) return;
    if (parsed === amount) return;
    const id = setTimeout(() => {
      mutate({ id: entry.id, date: entry.date, patch: { type: 'full', amount: parsed } });
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, amount, entry.id, entry.date, mutate]);

  return (
    <span className="flex items-center gap-1 text-xs">
      <input
        type="number"
        min={MIN_AMOUNT}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={de.recipeIngredientEditor.amountFor(name)}
        className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs text-muted-foreground hover:border-border focus:border-ring focus:text-foreground focus:outline-none"
      />
      <span className="text-muted-foreground">{unit}</span>
    </span>
  );
}
