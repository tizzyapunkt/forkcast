import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResolvePane, type ResolveItem } from './resolve-pane';
import type { ResolutionProposal } from '../../domain/food-resolution';

const item: ResolveItem = { name: 'Sumach' };

const newFood: ResolutionProposal = {
  verdict: 'new-food',
  confidence: 'medium',
  entry: {
    id: 'sumach',
    name: 'Sumach',
    synonyms: [],
    unit: 'g',
    macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    untracked: true,
  },
};

const noop = () => {};

// One client reused across rerenders so ResolvePane stays mounted (not remounted) —
// that's what exercises the proposal-arrives-after-mount path.
function makePane(proposal: ResolutionProposal | null, state: 'loading' | 'ready') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const tree = (p: ResolutionProposal | null, s: 'loading' | 'ready') => (
    <QueryClientProvider client={qc}>
      <ResolvePane
        item={item}
        state={s}
        proposal={p}
        context="create"
        onCreated={noop}
        onDiscard={noop}
        onRetry={noop}
        onClose={noop}
      />
    </QueryClientProvider>
  );
  const utils = render(tree(proposal, state));
  return { ...utils, update: (p: ResolutionProposal | null, s: 'loading' | 'ready') => utils.rerender(tree(p, s)) };
}

describe('ResolvePane', () => {
  // Regression: the sheet usually mounts while the proposal is still loading (prefetch /
  // create flow), so the proposal arrives AFTER mount. The editable draft must seed then,
  // not only via the mount-time useState initializer — otherwise the new-food body is blank.
  it('renders the new-food editor when the proposal arrives after mount', () => {
    const { update } = makePane(null, 'loading');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();

    update(newFood, 'ready');

    expect(screen.getByLabelText('Name')).toHaveValue('Sumach');
    // Untracked → the "Nicht zählen" toggle is on (and the macro grid is hidden).
    expect(screen.getByLabelText('Nicht zählen')).toBeChecked();
  });

  it('renders the editor when mounted with the proposal already present', () => {
    makePane(newFood, 'ready');
    expect(screen.getByLabelText('Name')).toHaveValue('Sumach');
  });
});
