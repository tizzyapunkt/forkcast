import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { ChevronRight } from 'lucide-react';
import { useRecipes } from '../../queries/use-recipes';
import { computeRecipeTotals } from '../../domain/recipe-totals';
import type { Recipe } from '../../domain/recipes';
import { de } from '../../i18n/de';

interface Props {
  onSelect: (recipe: Recipe) => void;
}

export function RecipePanel({ onSelect }: Props) {
  const { data: recipes, isLoading } = useRecipes();
  const [query, setQuery] = useState('');

  const fuse = useMemo(
    () =>
      new Fuse(recipes ?? [], {
        keys: ['name'],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [recipes],
  );

  const trimmed = query.trim();
  const filtered: Recipe[] = trimmed ? fuse.search(trimmed).map((r) => r.item) : (recipes ?? []);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 p-4">
      <input
        role="searchbox"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={de.recipePanel.placeholder}
        className="w-full min-w-0 appearance-none rounded-md border px-3 py-2 text-base sm:text-sm"
      />

      {isLoading && <p className="text-sm text-muted-foreground">{de.recipePanel.loading}</p>}

      {!isLoading && (recipes?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">{de.recipePanel.empty}</p>
      )}

      {!isLoading && (recipes?.length ?? 0) > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">{de.recipePanel.noMatches(trimmed)}</p>
      )}

      {filtered.length > 0 && (
        <ul className="w-full min-w-0 divide-y">
          {filtered.map((recipe) => (
            <li key={recipe.id} className="min-w-0">
              <button
                onClick={() => onSelect(recipe)}
                className="flex w-full min-w-0 items-center gap-2 py-2.5 text-left text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{recipe.name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {de.recipePanel.meta(recipe.ingredients.length, recipe.yield)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                  {de.recipePanel.kcalPerPortion(
                    Math.round(computeRecipeTotals(recipe.ingredients, recipe.yield).perServing.calories),
                  )}
                </span>
                <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground/60" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
