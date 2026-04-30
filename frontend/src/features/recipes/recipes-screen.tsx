import { useState } from 'react';
import { useRecipes } from '../../queries/use-recipes';
import { useAddRecipe } from '../../queries/use-add-recipe';
import { ErrorBanner } from '../../components/app/error-banner';
import { ListSkeleton } from '../../components/app/loading-skeleton';
import { RecipeForm } from './recipe-form';
import { RecipeDetail } from './recipe-detail';
import { de } from '../../i18n/de';

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'detail'; id: string };

export function RecipesScreen() {
  const [view, setView] = useState<View>({ mode: 'list' });
  const { data: recipes, isLoading, error } = useRecipes();
  const addMutation = useAddRecipe();

  if (view.mode === 'create') {
    return (
      <RecipeForm
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

  if (view.mode === 'detail') {
    return (
      <RecipeDetail id={view.id} onBack={() => setView({ mode: 'list' })} onDeleted={() => setView({ mode: 'list' })} />
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{de.recipes.screenTitle}</h2>
        <button
          onClick={() => setView({ mode: 'create' })}
          className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
          aria-label={de.recipes.newRecipeAria}
        >
          + {de.recipes.newRecipe}
        </button>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <ListSkeleton rows={4} />}

      {!isLoading && recipes && recipes.length === 0 && (
        <p className="text-sm text-muted-foreground">{de.recipes.empty}</p>
      )}

      {recipes && recipes.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <button
                onClick={() => setView({ mode: 'detail', id: recipe.id })}
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{recipe.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {de.recipes.listMeta(recipe.ingredients.length, recipe.yield)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
