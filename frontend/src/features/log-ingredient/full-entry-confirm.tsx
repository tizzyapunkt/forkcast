import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { MealSlot } from '../../domain/meal-log';
import { useLogIngredient } from '../../queries/use-log-ingredient';
import { ErrorBanner } from '../../components/app/error-banner';

const schema = z.object({
  amount: z.coerce.number({ invalid_type_error: 'Amount must be a number' }).positive('Amount must be greater than 0'),
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
          per {result.unit} — {m.calories} kcal · {m.protein}g P · {m.carbs}g C · {m.fat}g F
        </p>
        {amount !== null && (
          <p className="text-xs">
            <span className="text-muted-foreground">
              {amount} {result.unit} total —{' '}
            </span>
            <MacroChip value={m.calories * amount} label="kcal" unit="" /> ·{' '}
            <MacroChip value={m.protein * amount} label="protein" /> ·{' '}
            <MacroChip value={m.carbs * amount} label="carbs" /> · <MacroChip value={m.fat * amount} label="fat" />
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="amount" className="text-sm font-medium">
          Amount ({result.unit})
        </label>
        <input
          id="amount"
          type="number"
          step="1"
          {...register('amount')}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="e.g. 100"
          autoFocus
        />
        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="flex-1 rounded-md border px-4 py-2 text-sm">
          Back
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Log'}
        </button>
      </div>
    </form>
  );
}
