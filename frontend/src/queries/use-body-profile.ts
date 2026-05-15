import { useQuery } from '@tanstack/react-query';
import { getBodyProfile } from '../api/body-profile';
import { queryKeys } from './keys';

export function useBodyProfile() {
  return useQuery({
    queryKey: queryKeys.bodyProfile(),
    queryFn: getBodyProfile,
    retry: false,
  });
}
