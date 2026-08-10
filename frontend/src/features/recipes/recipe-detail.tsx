import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useRecipe } from '../../queries/use-recipe';
import { useUpdateRecipe } from '../../queries/use-update-recipe';
import { useDeleteRecipe } from '../../queries/use-delete-recipe';
import { RecipeForm } from './recipe-form';
import { RecipeTotalsStrip } from './recipe-totals-strip';
import { AppHeader } from '../../components/app/app-header';
import { ErrorBanner } from '../../components/app/error-banner';
import { de } from '../../i18n/de';
import type { RecipeIngredient } from '../../domain/recipes';
import { formatMassAmount, formatPieceCount, scaleIngredient } from './scale-ingredient';
import { Button } from '../../components/ui/button';

/** The right-aligned quantity text for one ingredient row in the recipe view. */
function formatIngredientQuantity(ing: RecipeIngredient, untracked: boolean): string {
  if (untracked) {
    const dq = ing.displayQuantity;
    if (dq) {
      return dq.amount !== undefined ? `${formatPieceCount(dq.amount)} ${dq.unitLabel}` : dq.unitLabel;
    }
    // Untracked with no label: a stated weight if there is one, otherwise "nach Geschmack"
    // (never "0 g").
    return ing.amount > 0 ? `${formatMassAmount(ing.amount)} ${ing.unit}` : de.recipeIngredientEditor.toTaste;
  }
  if (ing.pieceQuantity) {
    return `${formatPieceCount(ing.pieceQuantity.amount)} ${ing.pieceQuantity.unitLabel} (≈ ${formatMassAmount(ing.amount)} ${ing.unit})`;
  }
  return `${formatMassAmount(ing.amount)} ${ing.unit}`;
}

interface Props {
  id: string;
  onBack: () => void;
  onDeleted: () => void;
}

export function RecipeDetail({ id, onBack, onDeleted }: Props) {
  const { data: recipe, isLoading, error } = useRecipe(id);
  const updateMutation = useUpdateRecipe();
  const deleteMutation = useDeleteRecipe();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [servings, setServings] = useState<number | null>(null);

  const baseYield = recipe?.yield ?? null;
  useEffect(() => {
    if (baseYield !== null && servings === null) setServings(baseYield);
  }, [baseYield, servings]);

  if (isLoading) {
    return (
      <>
        <AppHeader onBack={onBack} backAria={de.recipes.backAria} />
        <p className="p-4 text-sm text-muted-foreground">{de.recipes.loading}</p>
      </>
    );
  }
  if (error) {
    return (
      <>
        <AppHeader onBack={onBack} backAria={de.recipes.backAria} />
        <ErrorBanner error={error} />
      </>
    );
  }
  if (!recipe) return null;

  if (editing) {
    return (
      <RecipeForm
        initial={recipe}
        title={de.recipeForm.titleEdit}
        submitLabel={de.recipes.save}
        isSubmitting={updateMutation.isPending}
        error={updateMutation.error}
        onCancel={() => setEditing(false)}
        onSubmit={(values) =>
          updateMutation.mutate(
            { id, patch: values },
            {
              onSuccess: () => setEditing(false),
            },
          )
        }
      />
    );
  }

  return (
    <>
      <AppHeader
        title={recipe.name}
        subtitle={de.recipes.yields(recipe.yield)}
        onBack={onBack}
        backAria={de.recipes.backAria}
      />
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            className="gap-1.5 py-1.5 px-3 text-primary"
            aria-label={de.recipes.editAria}
          >
            <Pencil size={14} aria-hidden="true" />
            {de.recipes.edit}
          </Button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
            aria-label={de.recipes.deleteAria}
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>

        <RecipeTotalsStrip ingredients={recipe.ingredients} yield={recipe.yield} />

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">{de.recipes.ingredients}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{de.recipes.servingsLabel}</span>
              {(servings ?? recipe.yield) !== recipe.yield && (
                <button
                  type="button"
                  onClick={() => setServings(recipe.yield)}
                  aria-label={de.recipes.servingsResetAria(recipe.yield)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {de.recipes.servingsReset}
                </button>
              )}
              <div className="flex items-center gap-1 rounded-md border px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setServings((s) => Math.max(1, (s ?? recipe.yield) - 1))}
                  aria-label={de.recipes.servingsDecrement}
                  className="px-2 py-0.5 text-sm leading-none disabled:opacity-50"
                  disabled={(servings ?? recipe.yield) <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  readOnly
                  value={servings ?? recipe.yield}
                  aria-label={de.recipes.servingsLabel}
                  className="w-8 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setServings((s) => Math.max(1, (s ?? recipe.yield) + 1))}
                  aria-label={de.recipes.servingsIncrement}
                  className="px-2 py-0.5 text-sm leading-none"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <ul className="divide-y">
            {recipe.ingredients.map((ing, idx) => {
              const untracked = ing.untracked === true;
              const factor = (servings ?? recipe.yield) / recipe.yield;
              const scaled = scaleIngredient(ing, factor);
              return (
                <li
                  key={`${ing.name}|${idx}`}
                  data-untracked={untracked || undefined}
                  className={`flex items-start justify-between gap-2 py-2 text-sm ${untracked ? 'text-muted-foreground' : ''}`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{ing.name}</span>
                      {untracked && (
                        <span
                          data-testid={`untracked-badge-${idx}`}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
                        >
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
                          {de.recipeIngredientEditor.untrackedBadge}
                        </span>
                      )}
                    </span>
                    {ing.note !== undefined && (
                      <span data-testid={`ingredient-note-${idx}`} className="text-xs italic text-muted-foreground">
                        {ing.note}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{formatIngredientQuantity(scaled, untracked)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium">{de.recipes.steps}</h2>
          {recipe.steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{de.recipes.noSteps}</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {recipe.steps.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ol>
          )}
        </section>

        {confirmDelete && (
          <div className="rounded-md border border-destructive bg-destructive/5 p-3">
            <p className="mb-2 text-sm">{de.recipes.deleteConfirm(recipe.name)}</p>
            {deleteMutation.error && <ErrorBanner error={deleteMutation.error} />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1 px-3">
                {de.recipeForm.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  deleteMutation.mutate(id, {
                    onSuccess: () => onDeleted(),
                  })
                }
                disabled={deleteMutation.isPending}
                className="flex-1 px-3"
              >
                {deleteMutation.isPending ? de.recipes.deleting : de.recipes.deleteBtn}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
