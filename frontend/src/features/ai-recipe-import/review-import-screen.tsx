import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../../components/app/app-header';
import { useAddRecipe } from '../../queries/use-add-recipe';
import { useProposeResolutions } from '../../queries/use-resolve-ingredients';
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
import { DebugBox } from './debug-box';

const r = de.aiRecipeImport.resolve;

interface Props {
  draft: RecipeDraft;
  onSaved: () => void;
  onCancel: () => void;
  /** Source photos the draft was extracted from, surfaced for review-time comparison. */
  photos?: StagedPhoto[];
}

interface OverriddenInfo {
  extractedUnit: string;
}

function isMatched(ing: DraftIngredient): ing is MatchedDraftIngredient {
  return ing.matched;
}

function buildInitialMatchedIngredients(draft: RecipeDraft): {
  matched: RecipeIngredient[];
  overrideMap: Map<number, OverriddenInfo>;
  estimateIndices: Set<number>;
} {
  const matched: RecipeIngredient[] = [];
  const overrideMap = new Map<number, OverriddenInfo>();
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
    if (ing.unitOverridden) {
      overrideMap.set(idx, { extractedUnit: ing.unit });
    }
  });
  return { matched, overrideMap, estimateIndices };
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
  const [estimateIndices, setEstimateIndices] = useState<Set<number>>(initial.estimateIndices);
  const [unmatched, setUnmatched] = useState<UnmatchedDraftIngredient[]>(() =>
    draft.ingredients.filter((i): i is UnmatchedDraftIngredient => !i.matched),
  );
  const [openName, setOpenName] = useState<string | null>(null);
  const addMutation = useAddRecipe();
  const propose = useProposeResolutions();

  // Prefetch one batch of AI proposals for every unmatched item as the screen mounts.
  const initialUnmatched = useMemo(
    () => draft.ingredients.filter((i): i is UnmatchedDraftIngredient => !i.matched),
    [draft],
  );
  useEffect(() => {
    if (initialUnmatched.length === 0) return;
    propose.mutate(
      initialUnmatched.map((u) => ({
        name: u.name,
        ...(u.note !== undefined ? { note: u.note } : {}),
        ...(u.unit !== null ? { unit: u.unit } : {}),
        ...(u.amount !== null ? { amount: u.amount } : {}),
      })),
    );
    // Fire exactly once on mount for this draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUnmatched]);

  const proposalsByName = useMemo(() => {
    const map = new Map<string, ResolutionProposal>();
    if (propose.isSuccess && propose.data) {
      initialUnmatched.forEach((u, i) => {
        const p = propose.data[i];
        if (p) map.set(u.name, p);
      });
    }
    return map;
  }, [propose.isSuccess, propose.data, initialUnmatched]);

  const proposalState: ProposalState = propose.isError ? 'error' : propose.isSuccess ? 'ready' : 'loading';

  function clearEstimate(index: number) {
    setEstimateIndices((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function resolveUnmatched(name: string, ingredient: MatchedDraftIngredient) {
    setIngredients((prev) => [...prev, toRecipeIngredient(ingredient)]);
    setUnmatched((prev) => prev.filter((u) => u.name !== name));
    setOpenName(null);
  }

  function discardUnmatched(name: string) {
    setUnmatched((prev) => prev.filter((u) => u.name !== name));
    setOpenName(null);
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
    const u = unmatched.find((x) => x.name === openName);
    if (!u) return null;
    return {
      name: u.name,
      amount: u.amount,
      unit: u.unit,
      ...(u.note !== undefined ? { note: u.note } : {}),
      ...(u.pieceQuantity ? { pieceQuantity: u.pieceQuantity } : {}),
    };
  }, [unmatched, openName]);

  const unmatchedPanel =
    unmatched.length > 0 ? (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/60 dark:bg-amber-900/20">
        <p className="font-medium">{de.aiRecipeImport.unmatchedHeading(unmatched.length)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{de.aiRecipeImport.unmatchedHint}</p>
        <ul className="mt-2 space-y-1">
          {unmatched.map((u) => {
            const proposal = proposalsByName.get(u.name) ?? null;
            const hasProposal = proposalState === 'ready' && proposal !== null && proposal.verdict !== 'skip';
            return (
              <li key={u.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <span className="font-medium">{u.name}</span>
                    {u.amount !== null || u.unit !== null ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {u.amount ?? '—'} {u.unit ?? ''}
                      </span>
                    ) : null}
                  </span>
                  {u.note !== undefined && (
                    <span
                      data-testid={`unmatched-note-${u.name}`}
                      className="block truncate text-xs italic text-muted-foreground"
                    >
                      {u.note}
                    </span>
                  )}
                </span>
                {proposalState === 'loading' ? (
                  <span className="text-xs font-medium text-primary">{r.checking}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenName(u.name)}
                    aria-label={de.aiRecipeImport.resolveUnmatchedAria(u.name)}
                    className={
                      hasProposal
                        ? 'rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                        : 'rounded-md border px-3 py-1 text-xs font-medium'
                    }
                  >
                    {proposalState === 'error' ? r.retry : hasProposal ? r.assignCta : r.noProposal}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => discardUnmatched(u.name)}
                  aria-label={de.aiRecipeImport.discardUnmatchedAria(u.name)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
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
        onIngredientsChange={setIngredients}
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

      {/* Render override hints */}
      {initial.overrideMap.size > 0 && (
        <ul className="space-y-1 px-4 pb-2 text-xs text-muted-foreground">
          {ingredients.map((ing, idx) => {
            const override = initial.overrideMap.get(idx);
            if (!override) return null;
            return (
              <li
                key={`override-${idx}`}
                aria-label={de.aiRecipeImport.unitOverriddenAria}
                data-testid={`unit-override-${idx}`}
              >
                {ing.name}: {de.aiRecipeImport.unitOverridden(override.extractedUnit, ing.unit)}
              </li>
            );
          })}
        </ul>
      )}

      <ResolveSheet
        item={openItem}
        state={proposalState}
        proposal={openName ? (proposalsByName.get(openName) ?? null) : null}
        context="import"
        onResolved={(ingredient) => {
          if (openName) resolveUnmatched(openName, ingredient);
        }}
        onDiscard={() => {
          if (openName) discardUnmatched(openName);
        }}
        onRetry={() => {
          propose.reset();
          propose.mutate(
            initialUnmatched.map((u) => ({
              name: u.name,
              ...(u.note !== undefined ? { note: u.note } : {}),
              ...(u.unit !== null ? { unit: u.unit } : {}),
              ...(u.amount !== null ? { amount: u.amount } : {}),
            })),
          );
        }}
        onClose={() => setOpenName(null)}
      />

      {draft.debug && <DebugBox debug={draft.debug} />}
    </>
  );
}
