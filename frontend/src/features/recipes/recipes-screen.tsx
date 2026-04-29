import { useState } from 'react';
import { useRecipes } from '../../queries/use-recipes';
import { useAddRecipe } from '../../queries/use-add-recipe';
import { ErrorBanner } from '../../components/app/error-banner';
import { ListSkeleton } from '../../components/app/loading-skeleton';
import { RecipeForm } from './recipe-form';
import { RecipeDetail } from './recipe-detail';

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'detail'; id: string };

export function RecipesScreen() {
  const [view, setView] = useState<View>({ mode: 'list' });
  const { data: recipes, isLoading, error } = useRecipes();
  const addMutation = useAddRecipe();

  if (view.mode === 'create') {
    return (
      <RecipeForm
        submitLabel="Create"
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
        <h2 className="text-base font-semibold">Recipes</h2>
        <button
          onClick={() => setView({ mode: 'create' })}
          className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
          aria-label="New recipe"
        >
          + New recipe
        </button>
      </div>

      {error && <ErrorBanner error={error} />}
      {isLoading && <ListSkeleton rows={4} />}

      {!isLoading && recipes && recipes.length === 0 && (
        <p className="text-sm text-muted-foreground">No recipes yet — create one to get started.</p>
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
                  {recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'} · serves{' '}
                  {recipe.yield}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
