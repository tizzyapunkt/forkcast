import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeLogEntry } from '../api/remove-log-entry';
import { queryKeys } from './keys';

interface RemoveLogEntryInput {
  id: string;
  date: string;
}

export function useRemoveLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: RemoveLogEntryInput) => removeLogEntry(id),
    onSuccess: (_data, variables: RemoveLogEntryInput) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(variables.date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentlyUsedIngredients() });
    },
  });
}
