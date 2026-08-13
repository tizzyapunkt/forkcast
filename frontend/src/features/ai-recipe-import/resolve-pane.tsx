import { useEffect, useState } from 'react';
import { BottomSheet } from '../../components/app/bottom-sheet';
import { useConfirmResolution } from '../../queries/use-resolve-ingredients';
import { useDraftCatalogEntry } from '../../queries/use-catalog';
import { toEditableEntry } from '../../domain/food-catalog';
import { de } from '../../i18n/de';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { MacrosPerUnit, MeasurementUnit } from '../../domain/meal-log';
import type { MatchedDraftIngredient, PieceQuantity } from '../../domain/recipes';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { fold } from '../../lib/fold';
import { droppedQualifier } from './dropped-qualifier';
import { ManualMatch } from './resolve-manual-match';
import { NewFoodEditor } from './resolve-new-food-editor';
import { SynonymProposal } from './resolve-synonym-proposal';
import type {
  ConfirmResolutionPayload,
  FoodEntryDraft,
  OriginalDraftFields,
  ResolutionProposal,
} from '../../domain/food-resolution';

export type ProposalState = 'loading' | 'ready' | 'error';
export type ResolveContext = 'import' | 'create';

/**
 * Which body the sheet shows. `proposal` renders whatever verdict came back;
 * the other two are user overrides of it, so the verdict alone can no longer
 * decide what is on screen.
 */
type ResolveMode = 'proposal' | 'new-food' | 'manual';

/** The unmatched line (or search query) being resolved. */
export interface ResolveItem {
  name: string;
  amount?: number | null;
  unit?: MeasurementUnit | null;
  note?: string;
  pieceQuantity?: PieceQuantity;
  rawDisplayAmount?: number;
  rawDisplayUnitLabel?: string;
}

interface ResolvePaneProps {
  item: ResolveItem;
  state: ProposalState;
  proposal: ResolutionProposal | null;
  context?: ResolveContext;
  /** import host: append the resolved row to the ingredient list. */
  onResolved?: (ingredient: MatchedDraftIngredient) => void;
  /** create host: hand the chosen/created food to the next step (e.g. amount). */
  onCreated?: (result: IngredientSearchResult) => void;
  onDiscard: () => void;
  onRetry: () => void;
  onClose: () => void;
}

function perUnit(macrosPer100: MacrosPerUnit): MacrosPerUnit {
  return {
    calories: macrosPer100.calories / 100,
    protein: macrosPer100.protein / 100,
    carbs: macrosPer100.carbs / 100,
    fat: macrosPer100.fat / 100,
  };
}

function originalFields(item: ResolveItem): OriginalDraftFields {
  const fields: OriginalDraftFields = {};
  if (item.amount !== undefined) fields.amount = item.amount;
  if (item.unit !== undefined) fields.unit = item.unit;
  if (item.pieceQuantity) fields.pieceQuantity = item.pieceQuantity;
  if (item.note !== undefined) fields.note = item.note;
  if (item.rawDisplayAmount !== undefined) fields.rawDisplayAmount = item.rawDisplayAmount;
  if (item.rawDisplayUnitLabel !== undefined) fields.rawDisplayUnitLabel = item.rawDisplayUnitLabel;
  return fields;
}

/** Build a catalog-source search result for the create host from a confirmed new-food draft. */
function draftToSearchResult(entry: FoodEntryDraft): IngredientSearchResult {
  const result: IngredientSearchResult = {
    id: entry.id,
    source: 'CATALOG',
    name: entry.name,
    unit: entry.unit,
    macrosPerUnit: perUnit(entry.macrosPer100),
  };
  if (entry.untracked === true) result.untracked = true;
  return result;
}

const t = de.aiRecipeImport.resolve;

export function ResolvePane({
  item,
  state,
  proposal,
  context = 'import',
  onResolved,
  onCreated,
  onDiscard,
  onRetry,
  onClose,
}: ResolvePaneProps) {
  const isCreate = context === 'create';
  const aiAssisted = state === 'ready' && proposal !== null;

  const [draft, setDraft] = useState<FoodEntryDraft | null>(() =>
    proposal?.verdict === 'new-food' ? toEditableEntry(proposal.entry) : null,
  );
  /** The name the draft arrived under — retained as a synonym once the user renames it. */
  const [proposedName, setProposedName] = useState<string | null>(() =>
    proposal?.verdict === 'new-food' ? proposal.entry.name : null,
  );
  const [retainProposedName, setRetainProposedName] = useState(true);
  // The sheet often mounts before the proposal arrives (prefetch / create flow), so the
  // useState initializer above sees a null proposal. Seed the editable draft once the
  // new-food proposal lands; the `draft === null` guard preserves any edits the user made.
  useEffect(() => {
    if (proposal?.verdict === 'new-food' && draft === null) {
      setDraft(toEditableEntry(proposal.entry));
      setProposedName(proposal.entry.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal]);
  const [mode, setMode] = useState<ResolveMode>('proposal');
  const [returnMode, setReturnMode] = useState<ResolveMode>('proposal');
  /** A manual pick teaches the catalog the raw name, unless the user says it is no alias. */
  const [learnSynonym, setLearnSynonym] = useState(true);
  /** The alias a synonym verdict will store — editable, so a too-specific one can be trimmed. */
  const [synonymText, setSynonymText] = useState(() =>
    proposal?.verdict === 'synonym-of' ? proposal.synonym : item.name,
  );
  useEffect(() => {
    if (proposal?.verdict === 'synonym-of') setSynonymText(proposal.synonym);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal]);
  const confirmMutation = useConfirmResolution();
  const draftMutation = useDraftCatalogEntry();

  function goTo(next: ResolveMode) {
    setReturnMode(mode);
    setMode(next);
  }

  /**
   * Reject a synonym verdict and build an own entry for the raw name instead.
   * The draft is fetched once — coming back to a draft already on screen keeps
   * whatever the user edited into it.
   */
  function rejectSynonymForOwnEntry() {
    goTo('new-food');
    if (draft !== null || draftMutation.isPending) return;
    setProposedName(item.name);
    draftMutation.mutate(item.name, {
      onSuccess: (entry) => setDraft(toEditableEntry(entry)),
      onError: () => setDraft(toEditableEntry({ name: item.name })),
    });
  }

  /**
   * The proposed name, still worth keeping as an alias because the user renamed the
   * entry to something more generic — `null` once they drop it or rename back.
   */
  const retainedName =
    draft && proposedName !== null && retainProposedName && fold(draft.name) !== fold(proposedName)
      ? proposedName
      : null;
  const synonyms = draft ? (retainedName ? [...draft.synonyms, retainedName] : draft.synonyms) : [];

  function setSynonyms(next: string[]) {
    if (!draft) return;
    if (retainedName !== null && !next.some((s) => fold(s) === fold(retainedName))) {
      setRetainProposedName(false);
    }
    setDraft({ ...draft, synonyms: next.filter((s) => retainedName === null || fold(s) !== fold(retainedName)) });
  }

  // The recipe row's note. Renaming the entry to something generic leaves the recipe's
  // own qualifier ("dünne") homeless, so it is offered here — until the user types.
  const [note, setNote] = useState('');
  const [noteEdited, setNoteEdited] = useState(false);
  const statedNote = item.note !== undefined && item.note.trim().length > 0 ? item.note : '';
  const noteValue = noteEdited ? note : statedNote || (draft ? droppedQualifier(item.name, draft.name) : '');

  function original(): OriginalDraftFields {
    const fields = originalFields(item);
    if (noteValue.trim().length > 0) fields.note = noteValue;
    else delete fields.note;
    return fields;
  }

  function emitResolved(result: { ingredient: MatchedDraftIngredient; created?: IngredientSearchResult }) {
    if (isCreate && result.created && onCreated) onCreated(result.created);
    else onResolved?.(result.ingredient);
  }

  async function submit(payload: ConfirmResolutionPayload, created: IngredientSearchResult) {
    const res = await confirmMutation.mutateAsync(payload);
    emitResolved({ ingredient: res.ingredient, created });
  }

  function confirmNewFood() {
    if (!draft) return;
    const entry: FoodEntryDraft = { ...draft, synonyms };
    void submit({ kind: 'new-food', entry, original: original() }, draftToSearchResult(entry));
  }

  function confirmSynonym() {
    if (proposal?.verdict !== 'synonym-of') return;
    const created: IngredientSearchResult = {
      id: proposal.food.id,
      source: 'CATALOG',
      name: proposal.food.name,
      unit: proposal.food.unit,
      macrosPerUnit: perUnit(proposal.food.macrosPer100),
      ...(proposal.food.untracked ? { untracked: true as const } : {}),
    };
    void submit(
      {
        kind: 'synonym',
        foodId: proposal.foodId,
        synonym: synonymText.trim() || proposal.synonym,
        original: original(),
      },
      created,
    );
  }

  /**
   * Whether picking `result` teaches the catalog anything. Only a catalog entry can
   * carry an alias (an OFF or SCAN hit has no catalog id, a RECENT one only a
   * synthetic key), and a raw name that already *is* the entry's name is no alias.
   */
  function teachesSynonym(result: IngredientSearchResult): boolean {
    return (
      learnSynonym &&
      result.source === 'CATALOG' &&
      item.name.trim().length > 0 &&
      fold(item.name) !== fold(result.name)
    );
  }

  /** Resolve against a picked food without touching the catalog. */
  function resolveLocally(result: IngredientSearchResult) {
    if (isCreate) {
      onCreated?.(result);
      return;
    }
    const untracked = result.untracked === true;
    const ingredient: MatchedDraftIngredient = {
      matched: true,
      name: result.name,
      unit: result.unit,
      macrosPerUnit: result.macrosPerUnit,
      amount: untracked ? (item.amount ?? 0) : (item.amount ?? null),
      unitOverridden: false,
      // A RECENT pick is a catalog food surfaced from the log; every other source maps through.
      source: result.source === 'RECENT' ? 'CATALOG' : result.source,
    };
    if (untracked) ingredient.untracked = true;
    // A manual pick is a different food than the unmatched line — the original note
    // (prep for the old food) does not carry over, matching the picker-replace rule.
    onResolved?.(ingredient);
  }

  /** Manual catalog pick — resolves the row, and teaches the raw name as a synonym unless declined. */
  function pickManual(result: IngredientSearchResult) {
    if (!teachesSynonym(result)) {
      resolveLocally(result);
      return;
    }
    // The note carries the same picker-replace rule as `resolveLocally`: it described the
    // old food, not this one. A failed write must not block the import, so the row still
    // resolves — only the alias is lost.
    const { note: _note, ...withoutNote } = originalFields(item);
    confirmMutation
      .mutateAsync({ kind: 'synonym', foodId: result.id, synonym: item.name, original: withoutNote })
      .then((res) => emitResolved({ ingredient: res.ingredient, created: result }))
      .catch(() => resolveLocally(result));
  }

  const confirmError = confirmMutation.isError;
  /** An overridden verdict shows the editor with whatever the per-item draft call produced. */
  const editorAiAssisted = mode === 'new-food' ? draftMutation.isSuccess : aiAssisted;

  let body: React.ReactNode;
  let footer: React.ReactNode = null;
  /** The note belongs to the recipe row, so it shows wherever a row is about to be confirmed. */
  let showNote = false;

  if (mode === 'manual') {
    body = (
      <ManualMatch
        onPick={pickManual}
        onBack={() => setMode(returnMode)}
        rawName={item.name}
        learnSynonym={learnSynonym}
        setLearnSynonym={setLearnSynonym}
      />
    );
  } else if (mode === 'new-food') {
    body = draft ? (
      <NewFoodEditor
        draft={draft}
        setDraft={setDraft}
        synonyms={synonyms}
        setSynonyms={setSynonyms}
        aiAssisted={editorAiAssisted}
        onManual={() => goTo('manual')}
        onBack={() => setMode(returnMode)}
      />
    ) : (
      <DraftingState />
    );
    showNote = draft !== null;
    footer = draft ? (
      <ConfirmFooter
        label={isCreate ? t.confirmCreate : t.confirmImport}
        caption={t.captionNewFood}
        pending={confirmMutation.isPending}
        error={confirmError}
        onCancel={onClose}
        onConfirm={confirmNewFood}
      />
    ) : (
      <Button variant="outline" onClick={() => setMode(returnMode)} className="h-11 w-full py-0">
        {t.cancel}
      </Button>
    );
  } else if (state === 'loading') {
    body = <LoadingState />;
  } else if (state === 'error') {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-destructive">{t.errorTitle}</p>
        <p className="text-sm text-muted-foreground">{t.errorBody}</p>
        <Button variant="outline" onClick={onRetry} className="self-start px-3 py-1.5">
          {t.errorRetry}
        </Button>
      </div>
    );
    footer = <FallbackActions onManual={() => goTo('manual')} onDiscard={onDiscard} />;
  } else if (!proposal || proposal.verdict === 'skip') {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{t.noProposalTitle}</p>
        <p className="text-sm text-muted-foreground">{t.noProposalBody(item.name)}</p>
      </div>
    );
    footer = <FallbackActions onManual={() => goTo('manual')} onDiscard={onDiscard} />;
  } else if (proposal.verdict === 'synonym-of') {
    showNote = true;
    body = (
      <SynonymProposal
        proposal={proposal}
        rawName={item.name}
        synonym={synonymText}
        setSynonym={setSynonymText}
        onManual={() => goTo('manual')}
        onRejectForOwnEntry={rejectSynonymForOwnEntry}
      />
    );
    footer = (
      <ConfirmFooter
        label={isCreate ? t.confirmCreate : t.confirmImport}
        caption={t.captionSynonym}
        pending={confirmMutation.isPending}
        error={confirmError}
        onCancel={onClose}
        onConfirm={confirmSynonym}
      />
    );
  } else if (draft) {
    showNote = true;
    body = (
      <NewFoodEditor
        draft={draft}
        setDraft={setDraft}
        synonyms={synonyms}
        setSynonyms={setSynonyms}
        aiAssisted={aiAssisted}
        onManual={() => goTo('manual')}
      />
    );
    footer = (
      <ConfirmFooter
        label={isCreate ? t.confirmCreate : t.confirmImport}
        caption={t.captionNewFood}
        pending={confirmMutation.isPending}
        error={confirmError}
        onCancel={onClose}
        onConfirm={confirmNewFood}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {context === 'import' && mode !== 'manual' && (
          <div className="mb-3 rounded-md border border-input bg-accent/40 p-3">
            <span className="text-base font-bold">{item.name}</span>
            {(item.amount != null || item.unit) && (
              <span className="ml-2 text-sm font-medium text-muted-foreground">
                {item.amount ?? '—'} {item.unit ?? ''}
              </span>
            )}
            {item.note && <span className="ml-1 text-xs italic text-muted-foreground">· {item.note}</span>}
          </div>
        )}
        {body}
        {showNote && !isCreate && (
          <label className="mt-3 flex flex-col gap-1">
            <span className="text-sm font-medium">{t.noteLabel}</span>
            <Input
              value={noteValue}
              onChange={(e) => {
                setNoteEdited(true);
                setNote(e.target.value);
              }}
              placeholder={t.notePlaceholder}
              aria-label={t.noteLabel}
              className="h-10 w-full py-0 text-sm"
            />
            <span className="text-[11px] text-muted-foreground">{t.noteHint}</span>
          </label>
        )}
      </div>
      {footer && <div className="shrink-0 border-t p-4">{footer}</div>}
    </div>
  );
}

/** The per-item draft call fired by rejecting a synonym verdict. */
function DraftingState() {
  return (
    <div className="flex flex-col gap-3 py-2">
      <p className="text-sm font-medium text-primary">{t.draftingTitle}</p>
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-4 gap-2">
        <div className="h-12 animate-pulse rounded-md bg-muted" />
        <div className="h-12 animate-pulse rounded-md bg-muted" />
        <div className="h-12 animate-pulse rounded-md bg-muted" />
        <div className="h-12 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 py-2">
      <p className="text-sm font-medium text-primary">{t.loadingEyebrow}</p>
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      <div className="flex gap-2">
        <div className="h-12 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-12 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-12 flex-1 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

function FallbackActions({ onManual, onDiscard }: { onManual: () => void; onDiscard: () => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onManual} className="h-11 flex-1 py-0">
        {t.catalogFallback}
      </Button>
      <Button variant="destructiveOutline" onClick={onDiscard} className="h-11 flex-1 py-0">
        {de.aiRecipeImport.discardUnmatched}
      </Button>
    </div>
  );
}

function ConfirmFooter({
  label,
  caption,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  label: string;
  caption: string;
  pending: boolean;
  error: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-center text-xs text-destructive">{t.errorBody}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="h-12 flex-1 py-0">
          {t.cancel}
        </Button>
        <Button onClick={onConfirm} disabled={pending} className="h-12 flex-[1.5] py-0 font-semibold">
          {label}
        </Button>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

export function ResolveSheet({ item, ...rest }: { item: ResolveItem | null } & Omit<ResolvePaneProps, 'item'>) {
  return (
    <BottomSheet open={item !== null} onClose={rest.onClose} ariaLabel={item ? t.sheetTitle(item.name) : ''}>
      {item && (
        <>
          <div className="shrink-0 px-4 pt-3 pb-1">
            <h2 className="truncate text-sm font-semibold">{t.sheetTitle(item.name)}</h2>
          </div>
          <ResolvePane key={item.name} item={item} {...rest} />
        </>
      )}
    </BottomSheet>
  );
}
