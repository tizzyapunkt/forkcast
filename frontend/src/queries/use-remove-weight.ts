import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeWeight } from '../api/weight-log';
import { queryKeys } from './keys';

export function useRemoveWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeWeight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.weightLog() });
      queryClient.invalidateQueries({ queryKey: queryKeys.weightTrend() });
      queryClient.invalidateQueries({ queryKey: queryKeys.bodyProfile() });
    },
  });
}
