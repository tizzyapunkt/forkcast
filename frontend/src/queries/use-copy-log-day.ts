import { useMutation, useQueryClient } from '@tanstack/react-query';
import { copyLogDay, type CopyLogDayInput } from '../api/week-log';
import { queryKeys } from './keys';

export function useCopyLogDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: copyLogDay,
    onSuccess: (_data, variables: CopyLogDayInput) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(variables.toDate) });
      queryClient.invalidateQueries({ queryKey: queryKeys.weekLogAll() });
    },
  });
}
