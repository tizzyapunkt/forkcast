import { useCallback } from 'react';
import { useFavoriteIngredients } from '../../queries/use-favorite-ingredients';
import { useToggleFavoriteIngredient } from '../../queries/use-toggle-favorite-ingredient';
import { favoriteIdentityKey, type FavoriteUnit } from '../../domain/favorite-ingredients';
import type { MacrosPerUnit, MeasurementUnit } from '../../domain/meal-log';

export interface FavoritableIngredient {
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
}

/** Favorites are mass or volume based; anything else has no favoritable identity. */
export function toFavoriteUnit(unit: MeasurementUnit): FavoriteUnit | null {
  return unit === 'g' || unit === 'ml' ? unit : null;
}

/**
 * The favorites list plus the toggle, shared by every panel that renders a star.
 * The list is fetched once per open surface and reduced to a `Set` of identity
 * keys, so a row's star state is an O(1) lookup rather than a request per row.
 */
export function useFavorites() {
  const { data: favorites } = useFavoriteIngredients({ enabled: true });
  const { mutate, error, reset } = useToggleFavoriteIngredient();

  const identities = new Set((favorites ?? []).map((f) => favoriteIdentityKey(f.name, f.unit)));

  const isFavorite = useCallback(
    (name: string, unit: MeasurementUnit) => identities.has(favoriteIdentityKey(name, unit)),
    // Recomputed whenever the cached list changes; the Set itself is cheap to rebuild.
    [favorites], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggle = useCallback(
    (ingredient: FavoritableIngredient) => {
      const unit = toFavoriteUnit(ingredient.unit);
      if (!unit) return;
      mutate({
        name: ingredient.name,
        unit,
        macrosPerUnit: ingredient.macrosPerUnit,
        ...(ingredient.untracked ? { untracked: true } : {}),
        favorite: !isFavorite(ingredient.name, ingredient.unit),
      });
    },
    [mutate, isFavorite],
  );

  return { favorites, isFavorite, toggle, error, resetError: reset };
}
