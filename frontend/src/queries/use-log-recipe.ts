import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logRecipe, type LogRecipeInput } from '../api/recipes';
import { queryKeys } from './keys';

export function useLogRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logRecipe,
    onSuccess: (_data, variables: LogRecipeInput) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(variables.date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentlyUsedIngredients() });
    },
  });
}
