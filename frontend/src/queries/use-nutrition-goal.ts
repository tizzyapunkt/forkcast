import { useQuery } from '@tanstack/react-query';
import { getNutritionGoal } from '../api/nutrition-goal';
import { queryKeys } from './keys';

export function useNutritionGoal() {
  return useQuery({
    queryKey: queryKeys.nutritionGoal(),
    queryFn: getNutritionGoal,
    retry: false,
  });
}
