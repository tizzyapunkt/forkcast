import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logIngredient, type LogIngredientInput } from '../api/log-ingredient';
import { queryKeys } from './keys';

export function useLogIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logIngredient,
    onSuccess: (_data, variables: LogIngredientInput) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(variables.date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentlyUsedIngredients() });
    },
  });
}
