import { useQuery } from '@tanstack/react-query';
import { getFavoriteIngredients } from '../api/favorite-ingredients';
import { queryKeys } from './keys';

interface UseFavoriteIngredientsOptions {
  enabled: boolean;
}

/**
 * The favorites list, shared by the Favoriten tab and the star state on Search
 * and Recent rows. Unlike recently-used ingredients this is fetched as soon as
 * the surface opens, not lazily per tab: the default Search tab already needs it
 * to render each row's star correctly.
 */
export function useFavoriteIngredients({ enabled }: UseFavoriteIngredientsOptions) {
  return useQuery({
    queryKey: queryKeys.favoriteIngredients(),
    queryFn: getFavoriteIngredients,
    enabled,
    staleTime: 5 * 60_000,
  });
}
