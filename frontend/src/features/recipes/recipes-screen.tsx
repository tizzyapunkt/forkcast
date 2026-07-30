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
import { Camera, ChevronRight, CookingPot, Plus } from 'lucide-react';
import { AppHeader } from '../../components/app/app-header';
import { de, formatMacroTriplet } from '../../i18n/de';
import { Button } from '../../components/ui/button';

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
    <>
      <AppHeader title={de.recipes.screenTitle} />
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          {importConfigured && (
            <Button
              variant="outline"
              onClick={() => setView({ mode: 'import' })}
              className="flex-1 gap-1.5 px-3 text-primary"
              aria-label={de.aiRecipeImport.entryButtonAria}
            >
              <Camera size={16} aria-hidden="true" />
              {de.aiRecipeImport.entryButton}
            </Button>
          )}
          <Button
            onClick={() => setView({ mode: 'create' })}
            className="flex-1 gap-1.5 px-3"
            aria-label={de.recipes.newRecipeAria}
          >
            <Plus size={16} aria-hidden="true" />
            {de.recipes.newButton}
          </Button>
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
                    className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-muted/40"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-primary"
                    >
                      <CookingPot size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{recipe.name}</span>
                      <span
                        data-testid={`recipe-macro-line-${recipe.id}`}
                        className="mt-0.5 block truncate text-xs tabular-nums"
                      >
                        <span className="font-bold text-primary">{Math.round(perServing.calories)} kcal</span>
                        <span className="text-muted-foreground">
                          {' · '}
                          {formatMacroTriplet(perServing.protein, perServing.carbs, perServing.fat)} / Portion
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                        {de.recipes.listMeta(recipe.ingredients.length, recipe.yield)}
                      </span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground/60" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
