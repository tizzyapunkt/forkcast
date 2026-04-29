import { useQuery } from '@tanstack/react-query';
import { getRecipe } from '../api/recipes';
import { queryKeys } from './keys';

export function useRecipe(id: string | null) {
  return useQuery({
    queryKey: queryKeys.recipe(id ?? ''),
    queryFn: () => getRecipe(id as string),
    enabled: !!id,
  });
}
