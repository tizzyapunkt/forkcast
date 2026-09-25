import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setCookedPortions, type SetCookedPortionsInput } from '../api/set-cooked-portions';
import { queryKeys } from './keys';

export function useSetCookedPortions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetCookedPortionsInput) => setCookedPortions(input),
    onSuccess: (_data, { date }: SetCookedPortionsInput) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.weekLogAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.groceryListAll() });
    },
  });
}
