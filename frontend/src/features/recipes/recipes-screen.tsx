import { useEffect, useState } from 'react';
import { useRecipes } from '../../queries/use-recipes';
import { useAddRecipe } from '../../queries/use-add-recipe';
import { ErrorBanner } from '../../components/app/error-banner';
import { ListSkeleton } from '../../components/app/loading-skeleton';
import { RecipeForm } from './recipe-form';
import { RecipeDetail } from './recipe-detail';
import { ImportRecipeScreen } from '../ai-recipe-import/import-recipe-screen';
import { useImportConfigured } from '../ai-recipe-import/use-import-configured';
import { computeRecipeTotals } from '../../domain/recipe-totals';
import { de } from '../../i18n/de';

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'import' } | { mode: 'detail'; id: string };

interface Props {
  /** Notifies the app shell when a recipe sub-screen (detail/create/edit/import) is active so it can hide the bottom nav. */
  onSubScreenChange?: (active: boolean) => void;
}

export function RecipesScreen({ onSubScreenChange }: Props = {}) {
  const [view, setView] = useState<View>({ mode: 'list' });
  const { data: recipes, isLoading, error } = useRecipes();
  const { data: importConfigured } = useImportConfigured();
  const addMutation = useAddRecipe();

  useEffect(() => {
    onSubScreenChange?.(view.mode !== 'list');
  }, [view.mode, onSubScreenChange]);

  if (view.mode === 'create') {
    return (
      <RecipeForm
        title={de.recipeForm.titleNew}
        submitLabel={de.recipes.create}
        isSubmitting={addMutation.isPending}
        error={addMutation.error}
        onCancel={() => setView({ mode: 'list' })}
        onSubmit={(values) =>
          addMutation.mutate(values, {
            onSuccess: () => setView({ mode: 'list' }),
          })
        }
      />
    );
  }

  if (view.mode === 'import') {
    return <ImportRecipeScreen onCancel={() => setView({ mode: 'list' })} onSaved={() => setView({ mode: 'list' })} />;
  }

  if (view.mode === 'detail') {
    return (
      <RecipeDetail id={view.id} onBack={() => setView({ mode: 'list' })} onDeleted={() => setView({ mode: 'list' })} />
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{de.recipes.screenTitle}</h2>
        <div className="flex gap-2">
          {importConfigured && (
            <button
              onClick={() => setView({ mode: 'import' })}
              className="rounded-md border px-3 py-1 text-sm"
              aria-label={de.aiRecipeImport.entryButtonAria}
            >
              {de.aiRecipeImport.entryButton}
            </button>
          )}
          <button
            onClick={() => setView({ mode: 'create' })}
            className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
            aria-label={de.recipes.newRecipeAria}
          >
            + {de.recipes.newRecipe}
          </button>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <ListSkeleton rows={4} />}

      {!isLoading && recipes && recipes.length === 0 && (
        <p className="text-sm text-muted-foreground">{de.recipes.empty}</p>
      )}

      {recipes && recipes.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {recipes.map((recipe) => {
            const { perServing } = computeRecipeTotals(recipe.ingredients, recipe.yield);
            return (
              <li key={recipe.id}>
                <button
                  onClick={() => setView({ mode: 'detail', id: recipe.id })}
                  className="flex w-full items-start justify-between gap-2 px-3 py-3 text-left text-sm hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{recipe.name}</span>
                    <span
                      data-testid={`recipe-macro-line-${recipe.id}`}
                      className="mt-0.5 block text-xs text-muted-foreground tabular-nums"
                    >
                      {de.recipes.macroLine(
                        Math.round(perServing.calories),
                        Math.round(perServing.protein),
                        Math.round(perServing.carbs),
                        Math.round(perServing.fat),
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {de.recipes.listMeta(recipe.ingredients.length, recipe.yield)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
