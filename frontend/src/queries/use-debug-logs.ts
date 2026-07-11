import { useQuery } from '@tanstack/react-query';
import { fetchDebugLogs } from '../api/debug-logs';
import { queryKeys } from './keys';

export function useDebugLogs() {
  return useQuery({
    queryKey: queryKeys.debugLogs(),
    queryFn: fetchDebugLogs,
    refetchOnWindowFocus: false,
  });
}
