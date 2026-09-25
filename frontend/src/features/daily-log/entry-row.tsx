import { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import type { FullIngredientEntry, LogEntry, QuickIngredientEntry } from '../../domain/meal-log';
import { useRecipes } from '../../queries/use-recipes';
import { EditEntryDrawer } from '../edit-remove/edit-entry-drawer';
import { RemoveEntryConfirm } from '../edit-remove/remove-entry-confirm';
import { InlineAmountInput } from './inline-amount-input';
import { Button } from '../../components/ui/button';
import { de } from '../../i18n/de';

interface EntryRowProps {
  entry: LogEntry;
  /** Suppresses the per-row "aus {Rezept}" hint — used inside a recipe group, whose banner already names the recipe. */
  hideRecipeHint?: boolean;
  /** Shows a replace affordance — passed only for rows inside a recipe batch. */
  onReplace?: () => void;
}

export function EntryRow({ entry, hideRecipeHint, onReplace }: EntryRowProps) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [liveAmount, setLiveAmount] = useState<number | null>(null);
  const { ingredient } = entry;
  const { data: recipes } = useRecipes();
  const recipeName =
    entry.recipeId && !hideRecipeHint ? recipes?.find((r) => r.id === entry.recipeId)?.name : undefined;

  const label = ingredient.type === 'quick' ? ingredient.label : ingredient.name;
  const effectiveAmount = ingredient.type === 'full' ? (liveAmount ?? ingredient.amount) : 0;
  const calories =
    ingredient.type === 'quick' ? ingredient.calories : Math.round(ingredient.macrosPerUnit.calories * effectiveAmount);

  const macros =
    ingredient.type === 'full'
      ? {
          protein: ingredient.macrosPerUnit.protein * effectiveAmount,
          carbs: ingredient.macrosPerUnit.carbs * effectiveAmount,
          fat: ingredient.macrosPerUnit.fat * effectiveAmount,
        }
      : ingredient.protein !== undefined && ingredient.carbs !== undefined && ingredient.fat !== undefined
        ? { protein: ingredient.protein, carbs: ingredient.carbs, fat: ingredient.fat }
        : null;

  return (
    <>
      <div className="flex items-center justify-between gap-2 py-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{label}</span>
          {recipeName && (
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground" data-testid="recipe-hint">
              {de.entryRow.fromRecipe(recipeName)}
            </span>
          )}
          {ingredient.type === 'full' && (
            <InlineAmountInput
              entry={entry as LogEntry & { ingredient: FullIngredientEntry }}
              onLiveAmount={setLiveAmount}
            />
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {/* kcal and macros wrap onto two right-aligned lines when the row runs out of room. */}
          <span className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-1.5 text-right text-muted-foreground">
            <span className="whitespace-nowrap">
              {calories}
              {de.dailyLog.kcalSuffix}
            </span>
            {macros && (
              <span className="whitespace-nowrap text-xs">
                {de.dailyLog.macroInline(macros.protein, macros.carbs, macros.fat)}
              </span>
            )}
          </span>
          {ingredient.type === 'quick' && (
            <button
              onClick={() => setEditing(true)}
              aria-label={de.entryRow.editAria}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {de.entryRow.edit}
            </button>
          )}
          {onReplace && (
            <Button
              variant="ghost"
              size="iconSm"
              onClick={onReplace}
              aria-label={de.entryRow.replaceAria(label)}
              className="-my-1 text-muted-foreground"
            >
              <ArrowLeftRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="quietDestructive"
            size="iconSm"
            onClick={() => setRemoving(true)}
            aria-label={de.entryRow.removeAria}
            className="-my-1"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editing && ingredient.type === 'quick' && (
        <EditEntryDrawer
          entry={entry as LogEntry & { ingredient: QuickIngredientEntry }}
          onClose={() => setEditing(false)}
        />
      )}
      {removing && (
        <RemoveEntryConfirm entry={entry} onConfirm={() => setRemoving(false)} onCancel={() => setRemoving(false)} />
      )}
    </>
  );
}
