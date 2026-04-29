import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRecipe, type UpdateRecipeInput } from '../api/recipes';
import { queryKeys } from './keys';

interface UpdateRecipeArgs {
  id: string;
  patch: UpdateRecipeInput;
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateRecipeArgs) => updateRecipe(id, patch),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.recipe(id) });
    },
  });
}
