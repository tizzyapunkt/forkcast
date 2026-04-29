import { useQuery } from '@tanstack/react-query';
import { listRecipes } from '../api/recipes';
import { queryKeys } from './keys';

export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes(),
    queryFn: listRecipes,
    staleTime: 5 * 60_000,
  });
}
