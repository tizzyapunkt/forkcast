import { useState } from 'react';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { CookingBatch, Pot, PotRow } from '../../domain/cooking-session';
import { identityKey, swapPrefill } from '../../domain/cooking-session';
import { Button } from '../../components/ui/button';
import { DecimalInput } from '../../components/ui/decimal-input';
import { Field } from '../../components/ui/field';
import { formatPotAmount, weekdayIndex } from './cooking-format';
import { t } from '../../i18n';

interface AmountStepProps {
  food: IngredientSearchResult;
  /** The row being swapped; absent when adding a new ingredient. */
  from?: PotRow;
  pot: Pot;
  batches: CookingBatch[]; // the selected ones
  onConfirm: (potAmount: number) => void;
}

/**
 * The amount for the whole pot, after picking the food to swap in or add. Shows how it lands in each planned
 * meal and what a portion holds afterwards.
 */
export function AmountStep({ food, from, pot, batches, onConfirm }: AmountStepProps) {
  const prefill = from ? swapPrefill(pot, from, food) : null;
  const [amount, setAmount] = useState<number | null>(prefill);
  const valid = amount !== null && amount > 0;

  const perPortion = valid && pot.potPortions > 0 ? amount / pot.potPortions : 0;
  const existing = pot.rows.find((r) => r.key === identityKey(food) && r.key !== from?.key);
  const kcalNow = pot.macrosPerPortion.calories;
  const after = {
    calories: macroAfter('calories'),
    protein: macroAfter('protein'),
    carbs: macroAfter('carbs'),
    fat: macroAfter('fat'),
  };

  function macroAfter(macro: 'calories' | 'protein' | 'carbs' | 'fat'): number {
    const removed =
      (from ? from.perPortion * from.macrosPerUnit[macro] : 0) +
      (existing ? existing.perPortion * existing.macrosPerUnit[macro] : 0);
    return pot.macrosPerPortion[macro] - removed + perPortion * food.macrosPerUnit[macro];
  }

  const hint = from ? (prefill !== null ? t.cooking.prefillHint(from.name) : t.cooking.otherUnitHint) : undefined;

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onConfirm(amount);
      }}
    >
      <div className="flex-1 space-y-4 px-4 py-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{food.name}</div>
            <div className="text-xs text-muted-foreground">
              {[food.brand, t.searchPanel.kcalPer(food.macrosPerUnit.calories, food.unit)].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>

        <Field label={t.cooking.potAmountLabel(pot.potPortions)} hint={hint}>
          <div className="flex items-center gap-2">
            <DecimalInput
              value={amount}
              onValueChange={setAmount}
              autoFocus
              className="flex-1 text-lg font-semibold sm:text-lg"
            />
            <span className="shrink-0 text-muted-foreground">{t.groceryList.units[food.unit]}</span>
          </div>
        </Field>

        {valid && (
          <section className="space-y-1.5 rounded-lg border px-4 py-3 text-sm tabular-nums">
            <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t.cooking.breakdownHeading}
            </h3>
            <div className="flex justify-between">
              <span>{t.cooking.breakdownPerPortion}</span>
              <span className="font-semibold">{formatPotAmount(perPortion, food.unit)}</span>
            </div>
            {batches.map((b) => (
              <div key={b.key} className="flex justify-between text-muted-foreground">
                <span>{t.cooking.batchLabel(t.planner.weekdays[weekdayIndex(b.date)]!, t.slotLabels[b.slot])}</span>
                <span>{formatPotAmount(perPortion * b.portions, food.unit)}</span>
              </div>
            ))}
            {pot.extraPortions > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{t.cooking.breakdownExtra(pot.extraPortions)}</span>
                <span>{formatPotAmount(perPortion * pot.extraPortions, food.unit)}</span>
              </div>
            )}
          </section>
        )}

        {valid && (
          <section className="rounded-lg border border-border/60 bg-gradient-to-b from-accent/10 to-card px-4 py-3 tabular-nums">
            <h3 className="text-[11px] font-semibold tracking-wider text-primary uppercase">
              {t.cooking.afterHeading}
            </h3>
            <p className="mt-1">
              <span className="text-2xl font-extrabold">{Math.round(after.calories)}</span>{' '}
              <span className="text-sm text-muted-foreground">
                {t.recipeTotals.kcalUnit} · {t.cooking.afterBefore(Math.round(kcalNow))}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.formatMacroTriplet(after.protein, after.carbs, after.fat)}
            </p>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-background px-4 pt-3 pb-4">
        <Button type="submit" disabled={!valid} className="min-h-11 w-full">
          {from ? t.cooking.confirmSwap : t.cooking.confirmAdd}
        </Button>
      </div>
    </form>
  );
}
