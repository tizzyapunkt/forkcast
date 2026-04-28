import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LogEntry, QuickIngredientEntry } from '../../domain/meal-log';
import { useScrollLock } from '../../hooks/use-scroll-lock';
import { useEditLogEntry } from '../../queries/use-edit-log-entry';
import { ErrorBanner } from '../../components/app/error-banner';

const quickSchema = z.object({
  calories: z.coerce.number().positive('Calories must be positive'),
  protein: z.coerce.number().nonnegative().optional(),
  carbs: z.coerce.number().nonnegative().optional(),
  fat: z.coerce.number().nonnegative().optional(),
});

interface EditEntryDrawerProps {
  entry: LogEntry & { ingredient: QuickIngredientEntry };
  onClose: () => void;
}

export function EditEntryDrawer({ entry, onClose }: EditEntryDrawerProps) {
  useScrollLock(true);
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
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit entry"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-background shadow-lg"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="text-sm font-semibold">Edit entry</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
          {error && <ErrorBanner error={error} />}
          <p className="text-sm font-medium text-muted-foreground">{ing.label}</p>

          <div className="space-y-1">
            <label htmlFor="edit-calories" className="text-sm font-medium">
              Calories (kcal)
            </label>
            <input
              id="edit-calories"
              type="number"
              {...register('calories')}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {errors.calories && <p className="text-xs text-destructive">{errors.calories.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['protein', 'carbs', 'fat'] as const).map((macro) => (
              <div key={macro} className="space-y-1">
                <label htmlFor={`edit-${macro}`} className="text-xs font-medium capitalize text-muted-foreground">
                  {macro} (g)
                </label>
                <input
                  id={`edit-${macro}`}
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
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </>
  );
}
