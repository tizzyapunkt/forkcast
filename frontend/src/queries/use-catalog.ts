import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCatalogEntry,
  draftCatalogEntry,
  fetchCatalog,
  removeCatalogEntry,
  updateCatalogEntry,
} from '../api/catalog';
import type { CatalogEntryDraft } from '../domain/food-catalog';
import { queryKeys } from './keys';

export function useCatalog() {
  return useQuery({ queryKey: queryKeys.catalog(), queryFn: fetchCatalog });
}

/**
 * Every catalog write invalidates the list *and* every ingredient search, because
 * a corrected macro or a removed synonym changes what the picker shows.
 */
function useCatalogMutation<TVariables, TData>(mutationFn: (vars: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog() });
      void queryClient.invalidateQueries({ queryKey: ['ingredient-search'] });
    },
  });
}

export function useAddCatalogEntry() {
  return useCatalogMutation((entry: CatalogEntryDraft) => addCatalogEntry(entry));
}

export function useUpdateCatalogEntry() {
  return useCatalogMutation(({ id, entry }: { id: string; entry: CatalogEntryDraft }) => updateCatalogEntry(id, entry));
}

export function useRemoveCatalogEntry() {
  return useCatalogMutation((id: string) => removeCatalogEntry(id));
}

/** The AI fill. A mutation, not a query: it fires on an explicit user action and caches nothing. */
export function useDraftCatalogEntry() {
  return useMutation({ mutationFn: (name: string) => draftCatalogEntry(name) });
}
