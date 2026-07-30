import { Check, Minus, Plus } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Recipe } from '../../domain/recipes';
import type { MealSlot } from '../../domain/meal-log';
import { scaleIngredients } from '../../domain/scale-recipe-ingredients';
import { useLogRecipe } from '../../queries/use-log-recipe';
import { ErrorBanner } from '../../components/app/error-banner';
import { Button } from '../../components/ui/button';
import { DecimalInput } from '../../components/ui/decimal-input';
import { Field } from '../../components/ui/field';
import { de, formatMacroTriplet } from '../../i18n/de';

const schema = z.object({
  portions: z.coerce
    .number({ invalid_type_error: de.recipeConfirm.validation.portionsNumber })
    .positive(de.recipeConfirm.validation.portionsPositive),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  recipe: Recipe;
  date: string;
  slot: MealSlot;
  onSuccess: () => void;
  /** When provided, renders a footer back button. In the add-food sheet the back affordance lives in the header instead. */
  onBack?: () => void;
}

export function RecipeConfirm({ recipe, date, slot, onSuccess, onBack }: Props) {
  const { mutate, isPending, error } = useLogRecipe();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { portions: 1 } });

  const rawPortions = watch('portions');
  const parsed = Number(rawPortions);
  const portions = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const factor = portions !== null ? portions / recipe.yield : 0;

  // Only tracked ingredients produce log entries (LogRecipe skips untracked) — the
  // preview and the totals must show exactly what will be logged.
  const tracked = recipe.ingredients.filter((ing) => ing.untracked !== true);

  const totals =
    portions === null
      ? null
      : tracked.reduce(
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
          {de.recipeConfirm.summaryLine(recipe.yield, recipe.ingredients.length)}
        </p>
      </div>

      <Field label={de.recipeConfirm.portionsLabel} htmlFor="portions" error={errors.portions?.message}>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setValue('portions', Math.max(1, (portions ?? 1) - 1), { shouldValidate: true })}
            disabled={(portions ?? 1) <= 1}
            aria-label={de.recipeConfirm.portionsDecrement}
          >
            <Minus size={16} aria-hidden="true" />
          </Button>
          <Controller
            name="portions"
            control={control}
            render={({ field }) => (
              <DecimalInput
                id="portions"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                className="w-full text-center font-semibold"
                autoFocus
              />
            )}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setValue('portions', (portions ?? 0) + 1, { shouldValidate: true })}
            aria-label={de.recipeConfirm.portionsIncrement}
          >
            <Plus size={16} aria-hidden="true" />
          </Button>
        </div>
      </Field>

      {totals && portions !== null && (
        <div
          data-testid="portion-summary-card"
          className="flex items-center justify-between gap-2 rounded-md bg-muted p-3 tabular-nums"
        >
          <span className="text-2xl font-extrabold text-primary">
            {Math.round(totals.calories)} <span className="text-sm font-semibold">kcal</span>
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            {formatMacroTriplet(totals.protein, totals.carbs, totals.fat)}
          </span>
        </div>
      )}

      {totals && portions !== null && (
        <div className="rounded-md border p-3 text-xs">
          <p className="mb-1 font-medium">{de.recipeConfirm.willLogHeading(tracked.length)}</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {scaleIngredients(tracked, factor).map((ing, i) => (
              <li key={i}>
                {ing.name} —{' '}
                {ing.pieceQuantity
                  ? de.recipeIngredientEditor.pieceSummary(
                      ing.pieceQuantity.amount,
                      ing.pieceQuantity.unitLabel,
                      ing.amount,
                      ing.unit,
                    )
                  : `${ing.amount} ${ing.unit}`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">{de.recipeConfirm.adjustHint}</p>
        </div>
      )}

      <div className="flex gap-2">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            {de.recipeConfirm.back}
          </Button>
        )}
        <Button type="submit" disabled={isPending} className="flex-1">
          <Check size={17} aria-hidden="true" />
          {isPending ? de.recipeConfirm.logging : de.recipeConfirm.log}
        </Button>
      </div>
    </form>
  );
}
