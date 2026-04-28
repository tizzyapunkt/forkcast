import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNutritionGoal } from '../../queries/use-nutrition-goal';
import { useSetNutritionGoal } from '../../queries/use-set-nutrition-goal';
import { ErrorBanner } from '../../components/app/error-banner';

const schema = z.object({
  calories: z.coerce.number({ invalid_type_error: 'Calories must be a number' }).positive('Calories must be positive'),
  protein: z.coerce.number({ invalid_type_error: 'Protein must be a number' }).nonnegative('Protein must be ≥ 0'),
  carbs: z.coerce.number({ invalid_type_error: 'Carbs must be a number' }).nonnegative('Carbs must be ≥ 0'),
  fat: z.coerce.number({ invalid_type_error: 'Fat must be a number' }).nonnegative('Fat must be ≥ 0'),
});

type FormValues = z.infer<typeof schema>;

const FIELDS = [
  { key: 'calories' as const, label: 'Calories (kcal)' },
  { key: 'protein' as const, label: 'Protein (g)' },
  { key: 'carbs' as const, label: 'Carbs (g)' },
  { key: 'fat' as const, label: 'Fat (g)' },
];

export function NutritionGoalForm() {
  const { data: goal, isLoading } = useNutritionGoal();
  const { mutate, isPending, error } = useSetNutritionGoal();
  const [saved, setSaved] = useState(false);

  const {
    register,
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

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      {error && <ErrorBanner error={error} />}
      {saved && <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">Saved</p>}

      {FIELDS.map(({ key, label }) => (
        <div key={key} className="space-y-1">
          <label htmlFor={`goal-${key}`} className="text-sm font-medium">
            {label}
          </label>
          <input
            id={`goal-${key}`}
            type="number"
            step="1"
            {...register(key)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="0"
          />
          {errors[key] && <p className="text-xs text-destructive">{errors[key]?.message}</p>}
        </div>
      ))}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save goal'}
      </button>
    </form>
  );
}
