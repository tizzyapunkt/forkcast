import { computeRecipeTotals } from '../../domain/recipe-totals';
import type { RecipeIngredient } from '../../domain/recipes';
import { t } from '../../i18n';

interface Props {
  ingredients: RecipeIngredient[];
  yield: number;
  className?: string;
}

function fmt(value: number): number {
  return Math.round(value);
}

/**
 * Single Pro-Portion line on the recipe read view. Invariant under the servings
 * multiplier — it always shows per-serving values for the stored yield; the
 * multiplier scales only the ingredient rows.
 */
export function RecipeTotalsStrip({ ingredients, yield: recipeYield, className }: Props) {
  const { perServing } = computeRecipeTotals(ingredients, recipeYield);

  return (
    <section
      aria-label={t.recipeTotals.sectionAria}
      data-testid="recipe-totals-strip"
      className={`rounded-md bg-accent/10 px-3 py-2.5 text-sm ${className ?? ''}`}
    >
      <div className="flex items-baseline justify-between gap-2 tabular-nums">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {t.recipeTotals.perServingLabel}
        </span>
        <span data-testid="totals-per-serving" className="font-medium">
          {t.recipeTotals.summary(
            fmt(perServing.calories),
            fmt(perServing.protein),
            fmt(perServing.carbs),
            fmt(perServing.fat),
          )}
        </span>
      </div>
    </section>
  );
}
