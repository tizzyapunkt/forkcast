import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { AppHeader } from '../../components/app/app-header';
import { useAddRecipe } from '../../queries/use-add-recipe';
import { useIngredientResolutionProposals } from '../../queries/use-resolve-ingredients';
import { RecipeForm } from '../recipes/recipe-form';
import { SourcePhotos } from './source-photos';
import type { StagedPhoto } from './photo-staging';
import { ResolveSheet, type ProposalState, type ResolveItem } from './resolve-pane';
import type {
  DraftIngredient,
  MatchedDraftIngredient,
  RecipeDraft,
  RecipeIngredient,
  UnmatchedDraftIngredient,
} from '../../domain/recipes';
import type { ResolutionProposal } from '../../domain/food-resolution';
import { de } from '../../i18n/de';
import { Button } from '../../components/ui/button';
import { pairInitialRowProvenance, syncRowProvenance, type RowProvenance } from './row-provenance';

const r = de.aiRecipeImport.resolve;

interface Props {
  draft: RecipeDraft;
  onSaved: () => void;
  onCancel: () => void;
  /** Source photos the draft was extracted from, surfaced for review-time comparison. */
  photos?: StagedPhoto[];
}

function isMatched(ing: DraftIngredient): ing is MatchedDraftIngredient {
  return ing.matched;
}

function buildInitialMatchedIngredients(draft: RecipeDraft): {
  matched: RecipeIngredient[];
  estimateIndices: Set<number>;
  provenance: RowProvenance[];
} {
  const matched: RecipeIngredient[] = [];
  const estimateIndices = new Set<number>();
  draft.ingredients.forEach((ing) => {
    if (!isMatched(ing)) return;
    const idx = matched.length;
    const row: RecipeIngredient = {
      name: ing.name,
      unit: ing.unit,
      macrosPerUnit: ing.macrosPerUnit,
      amount: ing.amount ?? 0,
    };
    if (ing.pieceQuantity) {
      row.pieceQuantity = ing.pieceQuantity;
      estimateIndices.add(idx);
    }
    if (ing.untracked === true) row.untracked = true;
    if (ing.untracked === true && ing.displayQuantity) {
      row.displayQuantity = ing.displayQuantity;
    }
    if (ing.note !== undefined) row.note = ing.note;
    matched.push(row);
  });
  return { matched, estimateIndices, provenance: pairInitialRowProvenance(draft) };
}

/** An unmatched draft line, tagged with a key that survives duplicate names. */
interface UnmatchedEntry {
  key: string;
  item: UnmatchedDraftIngredient;
}

function collectUnmatched(draft: RecipeDraft): UnmatchedEntry[] {
  const entries: UnmatchedEntry[] = [];
  draft.ingredients.forEach((ing, index) => {
    if (!isMatched(ing)) entries.push({ key: `${index}:${ing.name}`, item: ing });
  });
  return entries;
}

function toRecipeIngredient(m: MatchedDraftIngredient): RecipeIngredient {
  const row: RecipeIngredient = {
    name: m.name,
    unit: m.unit,
    macrosPerUnit: m.macrosPerUnit,
    amount: m.amount ?? 0,
  };
  if (m.pieceQuantity) row.pieceQuantity = m.pieceQuantity;
  if (m.untracked === true) row.untracked = true;
  if (m.displayQuantity) row.displayQuantity = m.displayQuantity;
  if (m.note !== undefined) row.note = m.note;
  return row;
}

export function ReviewImportScreen({ draft, onSaved, onCancel, photos = [] }: Props) {
  const initial = useMemo(() => buildInitialMatchedIngredients(draft), [draft]);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(initial.matched);
  const [rowProvenance, setRowProvenance] = useState<RowProvenance[]>(initial.provenance);
  const [estimateIndices, setEstimateIndices] = useState<Set<number>>(initial.estimateIndices);

  // Keyed by draft position, not by name: a recipe may legitimately list the same raw name
  // twice ("Salz" for the water and the sauce), and both lines resolve independently.
  const initialUnmatched = useMemo(() => collectUnmatched(draft), [draft]);
  const [unmatched, setUnmatched] = useState<UnmatchedEntry[]>(() => initialUnmatched);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const addMutation = useAddRecipe();

  const proposalRequest = useMemo(
    () =>
      initialUnmatched.map(({ item }) => ({
        name: item.name,
        ...(item.note !== undefined ? { note: item.note } : {}),
        ...(item.unit !== null ? { unit: item.unit } : {}),
        ...(item.amount !== null ? { amount: item.amount } : {}),
      })),
    [initialUnmatched],
  );

  // One batch of AI proposals for every unmatched line, fetched as the screen mounts.
  const propose = useIngredientResolutionProposals(proposalRequest);

  const proposalsByKey = useMemo(() => {
    const map = new Map<string, ResolutionProposal>();
    if (propose.data) {
      initialUnmatched.forEach(({ key }, i) => {
        const p = propose.data[i];
        if (p) map.set(key, p);
      });
    }
    return map;
  }, [propose.data, initialUnmatched]);

  const proposalState: ProposalState = propose.isError
    ? 'error'
    : propose.data || proposalRequest.length === 0
      ? 'ready'
      : 'loading';

  /** Keep each row paired with the provenance it loaded with, across edits, swaps and removals. */
  function changeIngredients(next: RecipeIngredient[]) {
    setRowProvenance((prev) => syncRowProvenance(ingredients, next, prev));
    setIngredients(next);
  }

  function clearEstimate(index: number) {
    setEstimateIndices((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function resolveUnmatched(key: string, ingredient: MatchedDraftIngredient) {
    // Rows that arrive through the resolve flow were never matched at import, so they carry none.
    setIngredients((prev) => [...prev, toRecipeIngredient(ingredient)]);
    setRowProvenance((prev) => [...prev, undefined]);
    setUnmatched((prev) => prev.filter((u) => u.key !== key));
    setOpenKey(null);
  }

  function discardUnmatched(key: string) {
    setUnmatched((prev) => prev.filter((u) => u.key !== key));
    setOpenKey(null);
  }

  const initialRecipe = useMemo(
    () => ({
      id: '',
      name: draft.name,
      yield: draft.yield,
      ingredients: initial.matched,
      steps: draft.steps,
      createdAt: '',
      updatedAt: '',
    }),
    [draft, initial.matched],
  );

  const openItem: ResolveItem | null = useMemo(() => {
    const entry = unmatched.find((x) => x.key === openKey);
    if (!entry) return null;
    const u = entry.item;
    return {
      name: u.name,
      amount: u.amount,
      unit: u.unit,
      ...(u.note !== undefined ? { note: u.note } : {}),
      ...(u.pieceQuantity ? { pieceQuantity: u.pieceQuantity } : {}),
    };
  }, [unmatched, openKey]);

  const unmatchedPanel =
    unmatched.length > 0 ? (
      <div className="rounded-md border border-warning/50 bg-warning/5 p-3 text-sm">
        <p className="font-medium">{de.aiRecipeImport.unmatchedHeading(unmatched.length)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{de.aiRecipeImport.unmatchedHint}</p>
        <ul className="mt-2 space-y-1">
          {unmatched.map(({ key, item: u }) => {
            const proposal = proposalsByKey.get(key) ?? null;
            const hasProposal = proposalState === 'ready' && proposal !== null && proposal.verdict !== 'skip';
            return (
              <li key={key} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <span className="font-medium" title={u.name}>
                      {u.name}
                    </span>
                    {u.amount !== null || u.unit !== null ? (
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                        {u.amount ?? '—'} {u.unit ?? ''}
                      </span>
                    ) : null}
                  </span>
                  {u.note !== undefined && (
                    <span
                      data-testid={`unmatched-note-${u.name}`}
                      className="block truncate text-xs italic text-muted-foreground"
                      title={u.note}
                    >
                      {u.note}
                    </span>
                  )}
                </span>
                {proposalState === 'loading' ? (
                  <span className="shrink-0 text-xs font-medium text-primary">{r.checking}</span>
                ) : (
                  <Button
                    variant={hasProposal ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setOpenKey(key)}
                    aria-label={de.aiRecipeImport.resolveUnmatchedAria(u.name)}
                    className="min-h-9 shrink-0"
                  >
                    {proposalState === 'error' ? r.retry : hasProposal ? r.assignCta : r.noProposal}
                  </Button>
                )}
                <Button
                  variant="quietDestructive"
                  size="iconSm"
                  onClick={() => discardUnmatched(key)}
                  aria-label={de.aiRecipeImport.discardUnmatchedAria(u.name)}
                  className="-my-1"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  const headerSlot =
    photos.length > 0 || unmatchedPanel ? (
      <>
        <SourcePhotos photos={photos} />
        {unmatchedPanel}
      </>
    ) : null;

  return (
    <>
      <AppHeader title={de.aiRecipeImport.reviewTitle} onBack={onCancel} backAria={de.aiRecipeImport.back} />
      <RecipeForm
        initial={initialRecipe}
        ingredients={ingredients}
        onIngredientsChange={changeIngredients}
        provenance={rowProvenance}
        estimateIndices={estimateIndices}
        onEstimateAcknowledged={clearEstimate}
        submitLabel={de.recipes.create}
        isSubmitting={addMutation.isPending}
        error={addMutation.error}
        onCancel={onCancel}
        headerSlot={headerSlot}
        onSubmit={(values) =>
          addMutation.mutate(values, {
            onSuccess: () => onSaved(),
          })
        }
      />

      <ResolveSheet
        item={openItem}
        state={proposalState}
        proposal={openKey ? (proposalsByKey.get(openKey) ?? null) : null}
        context="import"
        onResolved={(ingredient) => {
          if (openKey) resolveUnmatched(openKey, ingredient);
        }}
        onDiscard={() => {
          if (openKey) discardUnmatched(openKey);
        }}
        onRetry={() => void propose.refetch()}
        onClose={() => setOpenKey(null)}
      />
    </>
  );
}
