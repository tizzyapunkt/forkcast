import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Recipe } from '../../domain/recipes';
import type { MealSlot } from '../../domain/meal-log';
import { useLogRecipe } from '../../queries/use-log-recipe';
import { ErrorBanner } from '../../components/app/error-banner';

const schema = z.object({
  portions: z.coerce
    .number({ invalid_type_error: 'Portions must be a number' })
    .positive('Portions must be greater than 0'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  recipe: Recipe;
  date: string;
  slot: MealSlot;
  onSuccess: () => void;
  onBack: () => void;
}

export function RecipeConfirm({ recipe, date, slot, onSuccess, onBack }: Props) {
  const { mutate, isPending, error } = useLogRecipe();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { portions: 1 } });

  const rawPortions = watch('portions');
  const parsed = Number(rawPortions);
  const portions = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const factor = portions !== null ? portions / recipe.yield : 0;

  const totals =
    portions === null
      ? null
      : recipe.ingredients.reduce(
          (acc, ing) => {
            const amt = ing.amount * factor;
            acc.calories += ing.macrosPerUnit.calories * amt;
            acc.protein += ing.macrosPerUnit.protein * amt;
            acc.carbs += ing.macrosPerUnit.carbs * amt;
            acc.fat += ing.macrosPerUnit.fat * amt;
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );

  function onSubmit({ portions: p }: FormValues) {
    mutate({ recipeId: recipe.id, portions: p, date, slot }, { onSuccess });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      {error && <ErrorBanner error={error} />}

      <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
        <p className="font-medium">{recipe.name}</p>
        <p className="text-xs text-muted-foreground">
          Recipe yields {recipe.yield} portion{recipe.yield === 1 ? '' : 's'} · {recipe.ingredients.length} ingredient
          {recipe.ingredients.length === 1 ? '' : 's'}
        </p>
        {totals && (
          <p className="text-xs text-muted-foreground">
            Total: <span className="font-medium text-foreground">{Math.round(totals.calories)} kcal</span> ·{' '}
            {Math.round(totals.protein)}g P · {Math.round(totals.carbs)}g C · {Math.round(totals.fat)}g F
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="portions" className="text-sm font-medium">
          Portions to log
        </label>
        <input
          id="portions"
          type="number"
          step="0.5"
          min="0"
          {...register('portions')}
          className="w-full rounded-md border px-3 py-2 text-sm"
          autoFocus
        />
        {errors.portions && <p className="text-xs text-destructive">{errors.portions.message}</p>}
      </div>

      {totals && portions !== null && (
        <div className="rounded-md border p-3 text-xs">
          <p className="mb-1 font-medium">Will log {recipe.ingredients.length} ingredient(s):</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>
                {ing.name} — {Math.round(ing.amount * factor * 10) / 10} {ing.unit}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="flex-1 rounded-md border px-4 py-2 text-sm">
          Back
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? 'Logging…' : 'Log'}
        </button>
      </div>
    </form>
  );
}
