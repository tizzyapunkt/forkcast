import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LogEntry, QuickIngredientEntry } from '../../domain/meal-log';
import { BottomSheet } from '../../components/app/bottom-sheet';
import { Button } from '../../components/ui/button';
import { DecimalInput } from '../../components/ui/decimal-input';
import { Field } from '../../components/ui/field';
import { useEditLogEntry } from '../../queries/use-edit-log-entry';
import { ErrorBanner } from '../../components/app/error-banner';
import { de } from '../../i18n/de';

// An empty / cleared macro field (DecimalInput emits null) means "not provided".
const optionalMacro = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().nonnegative().optional(),
);

const quickSchema = z.object({
  calories: z.coerce.number().positive(de.editEntry.validation.caloriesPositive),
  protein: optionalMacro,
  carbs: optionalMacro,
  fat: optionalMacro,
});

interface EditEntryDrawerProps {
  entry: LogEntry & { ingredient: QuickIngredientEntry };
  onClose: () => void;
}

export function EditEntryDrawer({ entry, onClose }: EditEntryDrawerProps) {
  const { mutate, isPending, error } = useEditLogEntry();
  const ing = entry.ingredient;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof quickSchema>>({
    resolver: zodResolver(quickSchema),
    defaultValues: {
      calories: ing.calories,
      protein: ing.protein,
      carbs: ing.carbs,
      fat: ing.fat,
    },
  });

  function onSubmit(values: z.infer<typeof quickSchema>) {
    mutate(
      {
        id: entry.id,
        date: entry.date,
        patch: {
          type: 'quick',
          calories: values.calories,
          protein: values.protein,
          carbs: values.carbs,
          fat: values.fat,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <BottomSheet open onClose={onClose} ariaLabel={de.editEntry.dialogAria} heightClassName="max-h-[90dvh]">
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold">{de.editEntry.title}</h2>
        <Button variant="ghost" onClick={onClose} className="p-0 text-muted-foreground hover:text-foreground">
          {de.editEntry.cancel}
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && <ErrorBanner error={error} />}
        <p className="text-sm font-medium text-muted-foreground">{ing.label}</p>

        <Field label={de.editEntry.caloriesLabel} htmlFor="edit-calories" error={errors.calories?.message}>
          <Controller
            name="calories"
            control={control}
            render={({ field }) => (
              <DecimalInput
                id="edit-calories"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                className="w-full"
              />
            )}
          />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          {(['protein', 'carbs', 'fat'] as const).map((macro) => (
            <Field key={macro} label={de.editEntry.macroLabel(de.macros[macro])} htmlFor={`edit-${macro}`} size="sm">
              <Controller
                name={macro}
                control={control}
                render={({ field }) => (
                  <DecimalInput
                    id={`edit-${macro}`}
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
          {isPending ? de.editEntry.saving : de.editEntry.save}
        </Button>
      </form>
    </BottomSheet>
  );
}
