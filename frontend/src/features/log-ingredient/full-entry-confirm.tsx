import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { MealSlot } from '../../domain/meal-log';
import { useLogIngredient } from '../../queries/use-log-ingredient';
import { ErrorBanner } from '../../components/app/error-banner';
import { de } from '../../i18n/de';

const schema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: de.fullEntry.validation.amountNumber })
    .positive(de.fullEntry.validation.amountPositive),
});

type FormValues = z.infer<typeof schema>;

interface FullEntryConfirmProps {
  result: IngredientSearchResult;
  date: string;
  slot: MealSlot;
  onSuccess: () => void;
  onBack: () => void;
}

function MacroChip({ value, label, unit = 'g' }: { value: number; label: string; unit?: string }) {
  return (
    <span className="text-muted-foreground">
      <span className="font-medium text-foreground">
        {Math.round(value)}
        {unit}
      </span>{' '}
      {label}
    </span>
  );
}

export function FullEntryConfirm({ result, date, slot, onSuccess, onBack }: FullEntryConfirmProps) {
  const { mutate, isPending, error } = useLogIngredient();
  const m = result.macrosPerUnit;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const rawAmount = watch('amount');
  const parsed = Number(rawAmount);
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  function onSubmit({ amount: a }: FormValues) {
    mutate(
      {
        date,
        slot,
        ingredient: {
          type: 'full',
          name: result.name,
          unit: result.unit,
          macrosPerUnit: m,
          amount: a,
        },
      },
      { onSuccess },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      {error && <ErrorBanner error={error} />}

      <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
        <p className="font-medium">{result.name}</p>
        <p className="text-xs text-muted-foreground">
          {de.fullEntry.perUnit(result.unit, m.calories, m.protein, m.carbs, m.fat)}
        </p>
        {amount !== null && (
          <p className="text-xs">
            <span className="text-muted-foreground">{de.fullEntry.totalIntro(amount, result.unit)}</span>
            <MacroChip value={m.calories * amount} label={de.fullEntry.macroKcal} unit="" />
            {' · '}
            <MacroChip value={m.protein * amount} label={de.fullEntry.macroProtein} />
            {' · '}
            <MacroChip value={m.carbs * amount} label={de.fullEntry.macroCarbs} />
            {' · '}
            <MacroChip value={m.fat * amount} label={de.fullEntry.macroFat} />
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="amount" className="text-sm font-medium">
          {de.fullEntry.amount(result.unit)}
        </label>
        <input
          id="amount"
          type="number"
          step="1"
          {...register('amount')}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder={de.fullEntry.amountPlaceholder}
          autoFocus
        />
        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="flex-1 rounded-md border px-4 py-2 text-sm">
          {de.fullEntry.back}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? de.fullEntry.saving : de.fullEntry.log}
        </button>
      </div>
    </form>
  );
}
