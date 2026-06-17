import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LogEntry, QuickIngredientEntry } from '../../domain/meal-log';
import { BottomSheet } from '../../components/app/bottom-sheet';
import { useEditLogEntry } from '../../queries/use-edit-log-entry';
import { ErrorBanner } from '../../components/app/error-banner';
import { de } from '../../i18n/de';
import { toDecimalValue, toOptionalDecimalValue } from '../../lib/decimal';

const quickSchema = z.object({
  calories: z.coerce.number().positive(de.editEntry.validation.caloriesPositive),
  protein: z.coerce.number().nonnegative().optional(),
  carbs: z.coerce.number().nonnegative().optional(),
  fat: z.coerce.number().nonnegative().optional(),
});

interface EditEntryDrawerProps {
  entry: LogEntry & { ingredient: QuickIngredientEntry };
  onClose: () => void;
}

export function EditEntryDrawer({ entry, onClose }: EditEntryDrawerProps) {
  const { mutate, isPending, error } = useEditLogEntry();
  const ing = entry.ingredient;

  const {
    register,
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
        <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
          {de.editEntry.cancel}
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && <ErrorBanner error={error} />}
        <p className="text-sm font-medium text-muted-foreground">{ing.label}</p>

        <div className="space-y-1">
          <label htmlFor="edit-calories" className="text-sm font-medium">
            {de.editEntry.caloriesLabel}
          </label>
          <input
            id="edit-calories"
            type="text"
            inputMode="decimal"
            {...register('calories', { setValueAs: toDecimalValue })}
            className="w-full rounded-md border px-3 py-2 text-base sm:text-sm"
          />
          {errors.calories && <p className="text-xs text-destructive">{errors.calories.message}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['protein', 'carbs', 'fat'] as const).map((macro) => (
            <div key={macro} className="space-y-1">
              <label htmlFor={`edit-${macro}`} className="text-xs font-medium text-muted-foreground">
                {de.editEntry.macroLabel(de.macros[macro])}
              </label>
              <input
                id={`edit-${macro}`}
                type="text"
                inputMode="decimal"
                {...register(macro, { setValueAs: toOptionalDecimalValue })}
                className="w-full rounded-md border px-2 py-1.5 text-base sm:text-sm"
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
          {isPending ? de.editEntry.saving : de.editEntry.save}
        </button>
      </form>
    </BottomSheet>
  );
}
