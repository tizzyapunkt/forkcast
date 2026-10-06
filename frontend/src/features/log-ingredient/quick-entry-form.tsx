import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MealSlot } from '../../domain/meal-log';
import { useLogIngredient } from '../../queries/use-log-ingredient';
import { ErrorBanner } from '../../components/app/error-banner';
import { Button } from '../../components/ui/button';
import { DecimalInput } from '../../components/ui/decimal-input';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { t } from '../../i18n';

// An empty / cleared macro field (DecimalInput emits null) means "not provided".
const optionalMacro = z.preprocess(
  (v: number | null | undefined) => (v === null || v === undefined ? undefined : v),
  z.coerce.number<number>().nonnegative().optional(),
);

const schema = z.object({
  label: z.string().min(1, t.quickEntry.validation.labelRequired),
  calories: z.coerce
    .number<number>({ error: t.quickEntry.validation.caloriesRequired })
    .positive(t.quickEntry.validation.caloriesRequired),
  protein: optionalMacro,
  carbs: optionalMacro,
  fat: optionalMacro,
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
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, FormValues>({
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

      <Field label={t.quickEntry.label} htmlFor="label" error={errors.label?.message}>
        <Input id="label" {...register('label')} className="w-full" placeholder={t.quickEntry.labelPlaceholder} />
      </Field>

      <Field label={t.quickEntry.calories} htmlFor="calories" error={errors.calories?.message}>
        <Controller
          name="calories"
          control={control}
          render={({ field }) => (
            <DecimalInput
              id="calories"
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              className="w-full"
              placeholder="0"
            />
          )}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        {(['protein', 'carbs', 'fat'] as const).map((macro) => (
          <Field key={macro} label={t.editEntry.macroLabel(t.macros[macro])} htmlFor={macro} size="sm">
            <Controller
              name={macro}
              control={control}
              render={({ field }) => (
                <DecimalInput
                  id={macro}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  size="sm"
                  className="w-full"
                  placeholder="—"
                />
              )}
            />
          </Field>
        ))}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t.quickEntry.saving : mode === 'edit' ? t.quickEntry.saveChanges : t.quickEntry.addEntry}
      </Button>
    </form>
  );
}
