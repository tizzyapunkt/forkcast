import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applyBodyProfileAsGoals } from '../api/body-profile';
import { queryKeys } from './keys';

export function useApplyBodyProfileAsGoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applyBodyProfileAsGoals,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nutritionGoal() });
      queryClient.invalidateQueries({ queryKey: queryKeys.bodyProfile() });
    },
  });
}
