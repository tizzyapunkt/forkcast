import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { MealSlot } from '../../domain/meal-log';
import { useLogIngredient } from '../../queries/use-log-ingredient';
import { ErrorBanner } from '../../components/app/error-banner';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { DecimalInput } from '../../components/ui/decimal-input';
import { Check } from 'lucide-react';
import { de, formatMacroTriplet } from '../../i18n/de';

const schema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: de.fullEntry.validation.amountNumber })
    .positive(de.fullEntry.validation.amountPositive),
});

type FormValues = z.infer<typeof schema>;

const QUICK_AMOUNTS = [25, 50, 100, 150, 200] as const;

interface FullEntryConfirmProps {
  result: IngredientSearchResult;
  date: string;
  slot: MealSlot;
  onSuccess: () => void;
  /** When provided, renders a footer back button. In the add-food sheet the back affordance lives in the header instead. */
  onBack?: () => void;
  defaultAmount?: number;
}

export function FullEntryConfirm({ result, date, slot, onSuccess, onBack, defaultAmount }: FullEntryConfirmProps) {
  const { mutate, isPending, error } = useLogIngredient();
  const m = result.macrosPerUnit;

  const effectiveDefault = defaultAmount ?? result.servingQuantity;

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: effectiveDefault !== undefined ? { amount: effectiveDefault } : undefined,
  });

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
      </div>

      <div className="space-y-1">
        <Field label={de.fullEntry.amount(result.unit)} htmlFor="amount" error={errors.amount?.message}>
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <DecimalInput
                id="amount"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                className="w-full"
                placeholder={de.fullEntry.amountPlaceholder}
                autoFocus
              />
            )}
          />
        </Field>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setValue('amount', a, { shouldValidate: true, shouldDirty: true })}
              aria-label={de.fullEntry.quickAmountAria(a, result.unit)}
              className={`rounded-full border px-3 py-1 text-xs ${
                amount === a ? 'border-accent bg-accent/10 font-medium text-foreground' : 'text-muted-foreground'
              }`}
            >
              {a} {result.unit}
            </button>
          ))}
        </div>
      </div>

      {amount !== null && (
        <div
          data-testid="amount-summary-card"
          className="flex items-center justify-between gap-2 rounded-md bg-muted p-3 tabular-nums"
        >
          <span className="text-2xl font-extrabold text-primary">
            {Math.round(m.calories * amount)} <span className="text-sm font-semibold">{de.fullEntry.macroKcal}</span>
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            {formatMacroTriplet(m.protein * amount, m.carbs * amount, m.fat * amount)}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            {de.fullEntry.back}
          </Button>
        )}
        <Button type="submit" disabled={isPending} className="flex-1">
          <Check size={17} aria-hidden="true" />
          {isPending
            ? de.fullEntry.saving
            : amount !== null
              ? de.fullEntry.logAmount(amount, result.unit)
              : de.fullEntry.log}
        </Button>
      </div>
    </form>
  );
}
