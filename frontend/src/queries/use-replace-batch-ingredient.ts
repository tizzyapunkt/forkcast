import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaceBatchIngredient } from '../api/batch-ingredients';
import { queryKeys } from './keys';
import type { FullIngredientEntry } from '../domain/meal-log';

interface ReplaceBatchIngredientInput {
  entryId: string;
  date: string;
  ingredient: FullIngredientEntry;
}

export function useReplaceBatchIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, ingredient }: ReplaceBatchIngredientInput) =>
      replaceBatchIngredient({ entryId, ingredient }),
    onSuccess: (_data, { date }: ReplaceBatchIngredientInput) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.weekLogAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentlyUsedIngredients() });
      queryClient.invalidateQueries({ queryKey: queryKeys.favoriteIngredients() });
    },
  });
}
