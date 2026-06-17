import { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNutritionGoal } from '../../queries/use-nutrition-goal';
import { useSetNutritionGoal } from '../../queries/use-set-nutrition-goal';
import { ErrorBanner } from '../../components/app/error-banner';
import { DecimalInput } from '../../components/app/decimal-input';
import { de } from '../../i18n/de';

const schema = z.object({
  calories: z.coerce
    .number({ invalid_type_error: de.nutritionGoal.validation.caloriesNumber })
    .positive(de.nutritionGoal.validation.caloriesPositive),
  protein: z.coerce
    .number({ invalid_type_error: de.nutritionGoal.validation.proteinNumber })
    .nonnegative(de.nutritionGoal.validation.proteinNonneg),
  carbs: z.coerce
    .number({ invalid_type_error: de.nutritionGoal.validation.carbsNumber })
    .nonnegative(de.nutritionGoal.validation.carbsNonneg),
  fat: z.coerce
    .number({ invalid_type_error: de.nutritionGoal.validation.fatNumber })
    .nonnegative(de.nutritionGoal.validation.fatNonneg),
});

type FormValues = z.infer<typeof schema>;

const FIELDS = [
  { key: 'calories' as const, label: de.nutritionGoal.calories },
  { key: 'protein' as const, label: de.nutritionGoal.protein },
  { key: 'carbs' as const, label: de.nutritionGoal.carbs },
  { key: 'fat' as const, label: de.nutritionGoal.fat },
];

export function NutritionGoalForm() {
  const { data: goal, isLoading } = useNutritionGoal();
  const { mutate, isPending, error } = useSetNutritionGoal();
  const [saved, setSaved] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (goal) reset({ calories: goal.calories, protein: goal.protein, carbs: goal.carbs, fat: goal.fat });
  }, [goal, reset]);

  function onSubmit(values: FormValues) {
    setSaved(false);
    mutate(values, {
      onSuccess: () => setSaved(true),
    });
  }

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">{de.nutritionGoal.loading}</div>;

  const [kcalField, ...macroFields] = FIELDS;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border bg-card p-4">
      {error && <ErrorBanner error={error} />}
      {saved && <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{de.nutritionGoal.saved}</p>}

      <div className="space-y-1">
        <label htmlFor={`goal-${kcalField.key}`} className="text-sm font-medium">
          {kcalField.label}
        </label>
        <Controller
          name={kcalField.key}
          control={control}
          render={({ field }) => (
            <DecimalInput
              id={`goal-${kcalField.key}`}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              className="w-full rounded-md border px-3 py-2 text-base sm:text-sm"
              placeholder="0"
            />
          )}
        />
        {errors[kcalField.key] && <p className="text-xs text-destructive">{errors[kcalField.key]?.message}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {macroFields.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <label htmlFor={`goal-${key}`} className="text-sm font-medium">
              {label}
            </label>
            <Controller
              name={key}
              control={control}
              render={({ field }) => (
                <DecimalInput
                  id={`goal-${key}`}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className="w-full rounded-md border px-3 py-2 text-base tabular-nums sm:text-sm"
                  placeholder="0"
                />
              )}
            />
            {errors[key] && <p className="text-xs text-destructive">{errors[key]?.message}</p>}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isPending ? de.nutritionGoal.saving : de.nutritionGoal.save}
      </button>
    </form>
  );
}
