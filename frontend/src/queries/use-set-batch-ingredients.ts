import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setBatchIngredients } from '../api/batch-ingredients';
import type { BatchIngredientChange } from '../domain/cooking-session';
import { queryKeys } from './keys';

/** One cooking-view edit across the chosen batches; refreshes every day it touched, the week and the lists. */
export function useSetBatchIngredients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: BatchIngredientChange[]) => setBatchIngredients(changes),
    onSuccess: (_data, changes) => {
      for (const date of new Set(changes.map((c) => c.date))) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(date) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.weekLogAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.groceryListAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentlyUsedIngredients() });
    },
  });
}
