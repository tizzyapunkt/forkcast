import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearUnmatchedIngredients, fetchUnmatchedIngredients } from '../api/unmatched-ingredients';
import { queryKeys } from './keys';

export function useUnmatchedIngredients() {
  return useQuery({
    queryKey: queryKeys.unmatchedIngredients(),
    queryFn: fetchUnmatchedIngredients,
  });
}

export function useClearUnmatchedIngredients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearUnmatchedIngredients,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unmatchedIngredients() });
    },
  });
}
