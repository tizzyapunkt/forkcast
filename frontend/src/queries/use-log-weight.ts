import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logWeight } from '../api/weight-log';
import { queryKeys } from './keys';

export function useLogWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logWeight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.weightLog() });
      queryClient.invalidateQueries({ queryKey: queryKeys.weightTrend() });
      queryClient.invalidateQueries({ queryKey: queryKeys.bodyProfile() });
    },
  });
}
