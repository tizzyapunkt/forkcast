import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmResolution, proposeResolutions, exportUserFoods, fetchUserFoods } from '../api/food-resolution';
import type { ConfirmResolutionPayload, ResolutionItemInput } from '../domain/food-resolution';
import { queryKeys } from './keys';

/**
 * Batch-propose resolutions for a set of unmatched items. Modelled as a mutation
 * (not a query) because the review screen fires it imperatively on mount and the
 * input is a list, not a cache key. The caller holds the returned proposals.
 */
export function useProposeResolutions() {
  return useMutation({
    mutationFn: (items: ResolutionItemInput[]) => proposeResolutions(items),
  });
}

export function useConfirmResolution() {
  return useMutation({
    mutationFn: (payload: ConfirmResolutionPayload) => confirmResolution(payload),
  });
}

export function useUserFoodsOverlay() {
  return useQuery({
    queryKey: queryKeys.userFoodsOverlay(),
    queryFn: fetchUserFoods,
  });
}

export function useExportUserFoods() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: exportUserFoods,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userFoodsOverlay() });
    },
  });
}
