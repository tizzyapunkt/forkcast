import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeRecipeLog } from '../api/remove-recipe-log';
import { queryKeys } from './keys';

interface RemoveRecipeLogInput {
  recipeBatchId: string;
  date: string;
}

export function useRemoveRecipeLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeBatchId }: RemoveRecipeLogInput) => removeRecipeLog(recipeBatchId),
    onSuccess: (_data, variables: RemoveRecipeLogInput) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(variables.date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.weekLogAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentlyUsedIngredients() });
    },
  });
}
