import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addRecipe } from '../api/recipes';
import { queryKeys } from './keys';

export function useAddRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes() });
    },
  });
}
