import { useQuery } from '@tanstack/react-query';
import { getGroceryList } from '../api/grocery-list';
import { queryKeys } from './keys';

/** The week's grocery list — always fetched fresh, it is a projection of whatever is planned right now. */
export function useGroceryList(startDate: string) {
  return useQuery({
    queryKey: queryKeys.groceryList(startDate),
    queryFn: () => getGroceryList(startDate),
    staleTime: 0,
  });
}
