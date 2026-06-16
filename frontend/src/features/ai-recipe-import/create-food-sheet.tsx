import { useEffect, useMemo } from 'react';
import { useProposeResolutions } from '../../queries/use-resolve-ingredients';
import { ResolveSheet, type ProposalState, type ResolveItem } from './resolve-pane';
import type { IngredientSearchResult } from '../../domain/ingredient-search';

interface CreateFoodSheetProps {
  /** The search query to seed the new entry with; `null` keeps the sheet closed. */
  query: string | null;
  onClose: () => void;
  /** Called with the created (or catalog-picked) food so the host can continue (e.g. amount step). */
  onCreated: (result: IngredientSearchResult) => void;
}

/**
 * Hosts the reusable resolve sheet in `create` context: when opened with a query
 * it fires a single-item AI proposal, then lets the user confirm/edit a new food
 * (or fall back to manual catalog match). The confirmed food is handed back via
 * `onCreated` as a normal search selection.
 */
export function CreateFoodSheet({ query, onClose, onCreated }: CreateFoodSheetProps) {
  const propose = useProposeResolutions();

  useEffect(() => {
    if (query === null) {
      propose.reset();
      return;
    }
    propose.mutate([{ name: query }]);
    // Fire once per opened query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const item: ResolveItem | null = useMemo(() => (query === null ? null : { name: query }), [query]);
  const proposalState: ProposalState = propose.isError ? 'error' : propose.isSuccess ? 'ready' : 'loading';
  const proposal = propose.isSuccess && propose.data ? (propose.data[0] ?? null) : null;

  return (
    <ResolveSheet
      item={item}
      state={proposalState}
      proposal={proposal}
      context="create"
      onCreated={(result) => {
        onCreated(result);
        onClose();
      }}
      onDiscard={onClose}
      onRetry={() => {
        if (query === null) return;
        propose.reset();
        propose.mutate([{ name: query }]);
      }}
      onClose={onClose}
    />
  );
}
