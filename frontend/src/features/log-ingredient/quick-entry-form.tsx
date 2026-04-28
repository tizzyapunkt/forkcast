import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MealSlot } from '../../domain/meal-log';
import { useLogIngredient } from '../../queries/use-log-ingredient';
import { ErrorBanner } from '../../components/app/error-banner';

const schema = z.object({
  label: z.string().min(1, 'Label is required'),
  calories: z.coerce.number({ invalid_type_error: 'Calories is required' }).positive('Calories is required'),
  protein: z.coerce
    .number()
    .nonnegative()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v))),
  carbs: z.coerce
    .number()
    .nonnegative()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v))),
  fat: z.coerce
    .number()
    .nonnegative()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v))),
});

type FormValues = z.infer<typeof schema>;

interface QuickEntryFormProps {
  date: string;
  slot: MealSlot;
  onSuccess: () => void;
  initialValues?: Partial<FormValues>;
  mode?: 'create' | 'edit';
  entryId?: string;
}

export function QuickEntryForm({ date, slot, onSuccess, initialValues, mode = 'create' }: QuickEntryFormProps) {
  const { mutate, isPending, error } = useLogIngredient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  function onSubmit(values: FormValues) {
    mutate(
      {
        date,
        slot,
        ingredient: {
          type: 'quick',
          label: values.label,
          calories: values.calories,
          ...(values.protein !== undefined && { protein: values.protein }),
          ...(values.carbs !== undefined && { carbs: values.carbs }),
          ...(values.fat !== undefined && { fat: values.fat }),
        },
      },
      { onSuccess },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      {error && <ErrorBanner error={error} />}

      <div className="space-y-1">
        <label htmlFor="label" className="text-sm font-medium">
          Label
        </label>
        <input
          id="label"
          {...register('label')}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="e.g. Coffee, Banana…"
        />
        {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="calories" className="text-sm font-medium">
          Calories (kcal)
        </label>
        <input
          id="calories"
          type="number"
          {...register('calories')}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="0"
        />
        {errors.calories && <p className="text-xs text-destructive">{errors.calories.message}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['protein', 'carbs', 'fat'] as const).map((macro) => (
          <div key={macro} className="space-y-1">
            <label htmlFor={macro} className="text-xs font-medium capitalize text-muted-foreground">
              {macro} (g)
            </label>
            <input
              id={macro}
              type="number"
              step="0.1"
              {...register(macro)}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              placeholder="—"
            />
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isPending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add entry'}
      </button>
    </form>
  );
}
