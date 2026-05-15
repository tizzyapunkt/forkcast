import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveBodyProfile } from '../api/body-profile';
import { queryKeys } from './keys';

export function useSaveBodyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveBodyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bodyProfile() });
    },
  });
}
