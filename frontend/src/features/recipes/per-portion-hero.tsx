import { computeRecipeTotals } from '../../domain/recipe-totals';
import type { RecipeIngredient } from '../../domain/recipes';
import { de } from '../../i18n/de';

interface Props {
  ingredients: RecipeIngredient[];
  servings: number;
  onServingsChange: (next: number) => void;
}

function r(value: number): number {
  return Math.round(value);
}

/**
 * Pro-Portion hero card shown at the top of the recipe form: the per-serving macro headline plus the
 * servings stepper that drives the divisor, recomputed live from the in-memory ingredients + servings.
 */
export function PerPortionHero({ ingredients, servings, onServingsChange }: Props) {
  const { total, perServing } = computeRecipeTotals(ingredients, servings);
  const safeServings = Number.isFinite(servings) && servings > 0 ? servings : 1;

  return (
    <section
      aria-label={de.recipeTotals.sectionAria}
      data-testid="per-portion-hero"
      className="rounded-lg border border-border/60 bg-gradient-to-b from-accent/10 to-card px-4 py-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {de.recipeTotals.perServingLabel}
        </span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{de.recipeTotals.heroServingsPrefix}</span>
          <div className="flex items-center gap-1 rounded-md border bg-background px-1 py-0.5">
            <button
              type="button"
              onClick={() => onServingsChange(Math.max(1, safeServings - 1))}
              aria-label={de.recipes.servingsDecrement}
              disabled={safeServings <= 1}
              className="px-2 py-0.5 text-sm leading-none disabled:opacity-50"
            >
              −
            </button>
            <input
              type="number"
              readOnly
              value={safeServings}
              aria-label={de.recipes.servingsLabel}
              className="w-8 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => onServingsChange(Math.max(1, safeServings + 1))}
              aria-label={de.recipes.servingsIncrement}
              className="px-2 py-0.5 text-sm leading-none"
            >
              +
            </button>
          </div>
          <span>{de.recipeTotals.heroServingsSuffix}</span>
        </div>
      </div>

      <p data-testid="totals-per-serving" className="mt-1 tabular-nums">
        <span className="text-3xl font-extrabold tracking-tight text-foreground">{r(perServing.calories)}</span>{' '}
        <span className="text-sm text-muted-foreground">{de.recipeTotals.kcalUnit}</span>{' '}
        <span className="text-sm text-muted-foreground">
          · {r(perServing.protein)} P / {r(perServing.carbs)} C / {r(perServing.fat)} F
        </span>
      </p>

      <p
        data-testid="totals-secondary"
        className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground tabular-nums"
      >
        {de.recipeTotals.totalForServings(r(total.calories), safeServings)}
      </p>
    </section>
  );
}
