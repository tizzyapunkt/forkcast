import { computeRecipeTotals } from '../../domain/recipe-totals';
import type { RecipeIngredient } from '../../domain/recipes';
import { de } from '../../i18n/de';

interface Props {
  ingredients: RecipeIngredient[];
  yield: number;
  /**
   * Optional override: render a secondary "Bei N Portionen" line for the chosen serving count.
   * When omitted, the secondary line shows the total (= per-serving * yield).
   */
  chosenServings?: number;
  className?: string;
}

function fmt(value: number): number {
  return Math.round(value);
}

export function RecipeTotalsStrip({ ingredients, yield: recipeYield, chosenServings, className }: Props) {
  const { total, perServing } = computeRecipeTotals(ingredients, recipeYield);
  const servingsForSecondary = chosenServings ?? (Number.isFinite(recipeYield) && recipeYield > 0 ? recipeYield : 1);
  const secondary =
    chosenServings === undefined
      ? total
      : {
          calories: perServing.calories * servingsForSecondary,
          protein: perServing.protein * servingsForSecondary,
          carbs: perServing.carbs * servingsForSecondary,
          fat: perServing.fat * servingsForSecondary,
        };

  const secondaryLabel =
    chosenServings === undefined ? de.recipeTotals.totalLabel : de.recipeTotals.forServingsLabel(servingsForSecondary);

  return (
    <section
      aria-label={de.recipeTotals.sectionAria}
      data-testid="recipe-totals-strip"
      className={`rounded-md border bg-card px-3 py-2 text-sm ${className ?? ''}`}
    >
      <div className="flex items-baseline justify-between gap-2 tabular-nums">
        <span className="text-xs text-muted-foreground">{de.recipeTotals.perServingLabel}</span>
        <span data-testid="totals-per-serving" className="font-medium">
          {de.recipeTotals.summary(
            fmt(perServing.calories),
            fmt(perServing.protein),
            fmt(perServing.carbs),
            fmt(perServing.fat),
          )}
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span>{secondaryLabel}</span>
        <span data-testid="totals-secondary">
          {de.recipeTotals.summary(
            fmt(secondary.calories),
            fmt(secondary.protein),
            fmt(secondary.carbs),
            fmt(secondary.fat),
          )}
        </span>
      </div>
    </section>
  );
}
