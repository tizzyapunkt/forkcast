import { useQuery } from '@tanstack/react-query';
import { getRecentlyUsedIngredients } from '../api/recently-used-ingredients';
import { queryKeys } from './keys';

interface UseRecentlyUsedIngredientsOptions {
  enabled: boolean;
}

export function useRecentlyUsedIngredients({ enabled }: UseRecentlyUsedIngredientsOptions) {
  return useQuery({
    queryKey: queryKeys.recentlyUsedIngredients(),
    queryFn: getRecentlyUsedIngredients,
    enabled,
    staleTime: 5 * 60_000,
  });
}
