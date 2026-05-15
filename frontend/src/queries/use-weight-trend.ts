import { useQuery } from '@tanstack/react-query';
import { getWeightTrend } from '../api/weight-log';
import { queryKeys } from './keys';

export function useWeightTrend() {
  return useQuery({
    queryKey: queryKeys.weightTrend(),
    queryFn: () => getWeightTrend(),
  });
}
