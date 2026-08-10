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
import { de } from '../../i18n/de';

// An empty / cleared macro field (DecimalInput emits null) means "not provided".
const optionalMacro = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().nonnegative().optional(),
);

const schema = z.object({
  label: z.string().min(1, de.quickEntry.validation.labelRequired),
  calories: z.coerce
    .number({ invalid_type_error: de.quickEntry.validation.caloriesRequired })
    .positive(de.quickEntry.validation.caloriesRequired),
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

      <Field label={de.quickEntry.label} htmlFor="label" error={errors.label?.message}>
        <Input id="label" {...register('label')} className="w-full" placeholder={de.quickEntry.labelPlaceholder} />
      </Field>

      <Field label={de.quickEntry.calories} htmlFor="calories" error={errors.calories?.message}>
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
          <Field key={macro} label={de.editEntry.macroLabel(de.macros[macro])} htmlFor={macro} size="sm">
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
        {isPending ? de.quickEntry.saving : mode === 'edit' ? de.quickEntry.saveChanges : de.quickEntry.addEntry}
      </Button>
    </form>
  );
}
