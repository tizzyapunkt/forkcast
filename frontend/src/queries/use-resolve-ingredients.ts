import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmResolution, proposeResolutions } from '../api/food-resolution';
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConfirmResolutionPayload) => confirmResolution(payload),
    // A confirmed resolution writes a food or a synonym into the catalog, so both
    // the manager's list and any cached search go stale.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog() });
      void queryClient.invalidateQueries({ queryKey: ['ingredient-search'] });
    },
  });
}
