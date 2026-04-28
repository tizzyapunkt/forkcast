import { useQuery } from '@tanstack/react-query';
import { getDailyLog } from '../api/daily-log';
import { queryKeys } from './keys';

export function useDailyLog(date: string) {
  return useQuery({
    queryKey: queryKeys.dailyLog(date),
    queryFn: () => getDailyLog(date),
  });
}
