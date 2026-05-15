import { useQuery } from '@tanstack/react-query';
import { listWeightEntries } from '../api/weight-log';
import { queryKeys } from './keys';

export function useWeightLog() {
  return useQuery({
    queryKey: queryKeys.weightLog(),
    queryFn: listWeightEntries,
  });
}
