import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getGroceryList } from '../api/grocery-list';
import type { RecipePortions } from '../domain/grocery-list';
import { queryKeys } from './keys';

/**
 * The week's grocery list for the given portions per recipe — always fetched fresh, it is a projection of
 * whatever is planned right now. Changing portions keeps showing the previous list until the new one lands.
 */
export function useGroceryList(startDate: string, portions: RecipePortions = {}) {
  return useQuery({
    queryKey: queryKeys.groceryList(startDate, portions),
    queryFn: () => getGroceryList(startDate, portions),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}
