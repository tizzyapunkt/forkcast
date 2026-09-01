import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { Star } from 'lucide-react';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { FavoriteIngredient } from '../../domain/favorite-ingredients';
import { de } from '../../i18n/de';
import { Input } from '../../components/ui/input';
import { Banner } from '../../components/ui/banner';
import { FavoriteStar } from './favorite-star';
import { useFavorites } from './use-favorites';

interface FavoritesPanelProps {
  onSelect: (result: IngredientSearchResult, defaultAmount?: number) => void;
  /**
   * Drawer rows carry a second line with the amount the user last logged; recipe
   * picker rows do not — a last amount is log history and says nothing about how
   * much of the ingredient a recipe needs.
   */
  showLastAmount?: boolean;
}

function toSearchResult(favorite: FavoriteIngredient): IngredientSearchResult {
  return {
    id: `favorite:${favorite.name.toLowerCase()}|${favorite.unit}`,
    // Favorites reuse the RECENT source rather than adding a literal: `source`
    // drives the attribution badge and the search-source toggle, and a new value
    // would ripple into the backend's shared type for no user-visible gain.
    source: 'RECENT',
    name: favorite.name,
    unit: favorite.unit,
    macrosPerUnit: favorite.macrosPerUnit,
    ...(favorite.untracked ? { untracked: true } : {}),
  };
}

export function FavoritesPanel({ onSelect, showLastAmount = false }: FavoritesPanelProps) {
  const { favorites, toggle: toggleFavorite, error: favoriteError } = useFavorites();
  const [query, setQuery] = useState('');

  const isLoading = favorites === undefined;

  const fuse = useMemo(
    () =>
      new Fuse(favorites ?? [], {
        keys: ['name'],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [favorites],
  );

  const trimmed = query.trim();
  const filtered: FavoriteIngredient[] = trimmed ? fuse.search(trimmed).map((r) => r.item) : (favorites ?? []);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 p-4">
      {/* Rendered even while the list is empty, so the tab does not jump the
          moment the first favorite lands. */}
      <Input
        role="searchbox"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={de.favoritesPanel.placeholder}
        className="w-full appearance-none"
      />

      {favoriteError && (
        <Banner tone="error" density="sm">
          {de.favoriteStar.failed}
        </Banner>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">{de.favoritesPanel.loading}</p>}

      {!isLoading && favorites.length === 0 && (
        <p className="flex gap-2 text-sm text-pretty text-muted-foreground">
          {/* The star as it appears on a row, so the instruction is recognisable —
              tapping it elsewhere is the only way into this list. */}
          <Star aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" fill="currentColor" />
          <span>{de.favoritesPanel.empty}</span>
        </p>
      )}

      {!isLoading && favorites.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">{de.favoritesPanel.noMatches(trimmed)}</p>
      )}

      {filtered.length > 0 && (
        <ul className="w-full min-w-0 divide-y">
          {filtered.map((favorite) => {
            const kcal = de.favoritesPanel.kcalPer(favorite.macrosPerUnit.calories, favorite.unit);
            return (
              <li key={`${favorite.name.toLowerCase()}|${favorite.unit}`} className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(toSearchResult(favorite), showLastAmount ? favorite.lastAmount : undefined)}
                  className={
                    showLastAmount
                      ? 'flex min-w-0 flex-1 flex-col gap-0.5 py-2 text-left hover:bg-muted/50'
                      : 'flex min-w-0 flex-1 items-center justify-between gap-2 py-2.5 text-left text-sm hover:bg-muted/50'
                  }
                >
                  <span
                    className={
                      showLastAmount ? 'w-full truncate text-sm font-medium' : 'min-w-0 flex-1 truncate font-medium'
                    }
                  >
                    {favorite.name}
                  </span>
                  {showLastAmount ? (
                    <span className="w-full truncate text-xs leading-[1.35] text-muted-foreground">
                      {favorite.lastAmount === undefined ? (
                        <>
                          {kcal}
                          {' · '}
                          {/* One step quieter than muted: the absence of a last
                              amount is context, not the row's headline. */}
                          <span className="text-muted-foreground/70">{de.favoritesPanel.neverLogged}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-foreground">
                            {de.favoritesPanel.lastAmount(favorite.lastAmount, favorite.unit)}
                          </span>
                          {' · '}
                          {kcal}
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">{kcal}</span>
                  )}
                </button>
                <FavoriteStar name={favorite.name} favorited onToggle={() => toggleFavorite(favorite)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
