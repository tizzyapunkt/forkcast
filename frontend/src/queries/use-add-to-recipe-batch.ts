import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addToRecipeBatch, type AddToRecipeBatchInput } from '../api/batch-ingredients';
import { queryKeys } from './keys';

export function useAddToRecipeBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddToRecipeBatchInput) => addToRecipeBatch(input),
    onSuccess: (_data, { date }: AddToRecipeBatchInput) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.weekLogAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentlyUsedIngredients() });
      queryClient.invalidateQueries({ queryKey: queryKeys.favoriteIngredients() });
    },
  });
}
