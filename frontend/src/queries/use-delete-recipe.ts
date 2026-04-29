import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteRecipe } from '../api/recipes';
import { queryKeys } from './keys';

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.recipe(id) });
    },
  });
}
