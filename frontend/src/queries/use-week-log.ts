import { useQuery } from '@tanstack/react-query';
import { getWeekLog } from '../api/week-log';
import { queryKeys } from './keys';

export function useWeekLog(startDate: string) {
  return useQuery({
    queryKey: queryKeys.weekLog(startDate),
    queryFn: () => getWeekLog(startDate),
  });
}
