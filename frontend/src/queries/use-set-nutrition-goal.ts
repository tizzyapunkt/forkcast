import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setNutritionGoal } from '../api/nutrition-goal';
import { queryKeys } from './keys';

export function useSetNutritionGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setNutritionGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nutritionGoal() });
    },
  });
}
