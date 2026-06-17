import { useEffect, useState } from 'react';
import { BottomSheet } from '../../components/app/bottom-sheet';
import { DecimalInput } from '../../components/app/decimal-input';
import { SearchPanel } from '../log-ingredient/search-panel';
import { useConfirmResolution } from '../../queries/use-resolve-ingredients';
import { de } from '../../i18n/de';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { MacrosPerUnit, MeasurementUnit } from '../../domain/meal-log';
import type { MatchedDraftIngredient, PieceQuantity } from '../../domain/recipes';
import type {
  ConfirmResolutionPayload,
  FoodEntryDraft,
  OriginalDraftFields,
  ResolutionConfidence,
  ResolutionProposal,
} from '../../domain/food-resolution';

export type ProposalState = 'loading' | 'ready' | 'error';
export type ResolveContext = 'import' | 'create';

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

const CONFIDENCE_LABEL: Record<ResolutionConfidence, string> = {
  high: de.aiRecipeImport.resolve.confidenceHigh,
  medium: de.aiRecipeImport.resolve.confidenceMedium,
  low: de.aiRecipeImport.resolve.confidenceLow,
};

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

/** Build a USER-source search result for the create host from a confirmed new-food draft. */
function draftToSearchResult(entry: FoodEntryDraft): IngredientSearchResult {
  const result: IngredientSearchResult = {
    id: entry.id,
    source: 'USER',
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
    proposal?.verdict === 'new-food' ? { ...proposal.entry, macrosPer100: { ...proposal.entry.macrosPer100 } } : null,
  );
  // The sheet often mounts before the proposal arrives (prefetch / create flow), so the
  // useState initializer above sees a null proposal. Seed the editable draft once the
  // new-food proposal lands; the `draft === null` guard preserves any edits the user made.
  useEffect(() => {
    if (proposal?.verdict === 'new-food' && draft === null) {
      setDraft({ ...proposal.entry, macrosPer100: { ...proposal.entry.macrosPer100 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal]);
  const [manual, setManual] = useState(false);
  const confirmMutation = useConfirmResolution();

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
    void submit({ kind: 'new-food', entry: draft, original: originalFields(item) }, draftToSearchResult(draft));
  }

  function confirmSynonym() {
    if (proposal?.verdict !== 'synonym-of') return;
    const created: IngredientSearchResult = {
      id: proposal.food.id,
      source: 'FOODS',
      name: proposal.food.name,
      unit: proposal.food.unit,
      macrosPerUnit: perUnit(proposal.food.macrosPer100),
      ...(proposal.food.untracked ? { untracked: true as const } : {}),
    };
    void submit(
      { kind: 'synonym', foodId: proposal.foodId, synonym: proposal.synonym, original: originalFields(item) },
      created,
    );
  }

  /** Manual catalog pick — an existing food, no persistence needed; build the row client-side. */
  function pickManual(result: IngredientSearchResult) {
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
      source:
        result.source === 'USER'
          ? 'USER'
          : result.source === 'SCAN'
            ? 'SCAN'
            : result.source === 'OFF'
              ? 'OFF'
              : 'FOODS',
    };
    if (untracked) ingredient.untracked = true;
    // A manual pick is a different food than the unmatched line — the original note
    // (prep for the old food) does not carry over, matching the picker-replace rule.
    onResolved?.(ingredient);
  }

  const confirmError = confirmMutation.isError;

  let body: React.ReactNode;
  let footer: React.ReactNode = null;

  if (manual) {
    body = <ManualMatch onPick={pickManual} onBack={() => setManual(false)} />;
  } else if (state === 'loading') {
    body = <LoadingState />;
  } else if (state === 'error') {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-destructive">{t.errorTitle}</p>
        <p className="text-sm text-muted-foreground">{t.errorBody}</p>
        <button type="button" onClick={onRetry} className="self-start rounded-md border px-3 py-1.5 text-sm">
          {t.errorRetry}
        </button>
      </div>
    );
    footer = <FallbackActions onManual={() => setManual(true)} onDiscard={onDiscard} />;
  } else if (!proposal || proposal.verdict === 'skip') {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{t.noProposalTitle}</p>
        <p className="text-sm text-muted-foreground">{t.noProposalBody(item.name)}</p>
      </div>
    );
    footer = <FallbackActions onManual={() => setManual(true)} onDiscard={onDiscard} />;
  } else if (proposal.verdict === 'synonym-of') {
    body = <SynonymProposal proposal={proposal} rawName={item.name} onManual={() => setManual(true)} />;
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
    body = <NewFoodEditor draft={draft} setDraft={setDraft} aiAssisted={aiAssisted} onManual={() => setManual(true)} />;
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
        {context === 'import' && !manual && (
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
      </div>
      {footer && <div className="shrink-0 border-t p-4">{footer}</div>}
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
      <button type="button" onClick={onManual} className="h-11 flex-1 rounded-md border text-sm font-medium">
        {t.catalogFallback}
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="h-11 flex-1 rounded-md border border-destructive text-sm font-medium text-destructive"
      >
        {de.aiRecipeImport.discardUnmatched}
      </button>
    </div>
  );
}

function ConfidenceChip({ confidence }: { confidence: ResolutionConfidence }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {t.confidence(CONFIDENCE_LABEL[confidence])}
    </span>
  );
}

function SynonymProposal({
  proposal,
  rawName,
  onManual,
}: {
  proposal: Extract<ResolutionProposal, { verdict: 'synonym-of' }>;
  rawName: string;
  onManual: () => void;
}) {
  const { food } = proposal;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t.synonymEyebrow}</span>
        <ConfidenceChip confidence={proposal.confidence} />
      </div>
      <div className="rounded-md border border-input bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{food.name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">{t.catalogChip}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {Math.round(food.macrosPer100.calories)} {t.kcalLabel} · {t.macrosPer(food.unit)}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{t.synonymExplain(rawName, food.name)}</p>
      <button type="button" onClick={onManual} className="self-start text-sm font-medium text-primary">
        {t.synonymOtherLink}
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  estimate,
  onChange,
}: {
  label: string;
  value: number;
  estimate: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {label}
        {estimate && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />}
      </span>
      <DecimalInput
        value={Number.isFinite(value) ? value : 0}
        onValueChange={onChange}
        className="h-10 w-full rounded-md border px-2 text-right text-sm"
      />
    </label>
  );
}

function NewFoodEditor({
  draft,
  setDraft,
  aiAssisted,
  onManual,
}: {
  draft: FoodEntryDraft;
  setDraft: (d: FoodEntryDraft) => void;
  aiAssisted: boolean;
  onManual: () => void;
}) {
  const setMacro = (k: keyof MacrosPerUnit, v: number) =>
    setDraft({ ...draft, macrosPer100: { ...draft.macrosPer100, [k]: v } });

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
        {aiAssisted ? t.newEntryEyebrow : t.newEntryEyebrowManual}
      </span>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t.nameLabel}</span>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          aria-label={t.nameLabel}
          className="h-11 w-full rounded-md border px-3 text-base font-medium sm:text-sm"
        />
      </label>

      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="mb-1 block text-sm font-medium">{t.unitLabel}</span>
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {(['g', 'ml'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDraft({ ...draft, unit: u })}
                aria-pressed={draft.unit === u}
                className={`rounded px-4 py-1.5 text-sm font-medium ${
                  draft.unit === u ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 pb-1 text-sm">
          <input
            type="checkbox"
            checked={draft.untracked === true}
            onChange={(e) => setDraft({ ...draft, untracked: e.target.checked || undefined })}
            aria-label={t.untrackedToggle}
            className="h-4 w-4 rounded"
          />
          {t.untrackedToggle}
        </label>
      </div>

      {draft.untracked !== true && (
        <div>
          <span className="mb-1.5 block text-sm font-medium">
            {t.macrosLabel}{' '}
            <span className="text-xs font-normal text-muted-foreground">· {t.macrosPer(draft.unit)}</span>
          </span>
          <div className="grid grid-cols-4 gap-2">
            <NumberField
              label={t.kcalLabel}
              value={draft.macrosPer100.calories}
              estimate={aiAssisted}
              onChange={(v) => setMacro('calories', v)}
            />
            <NumberField
              label={t.proteinLabel}
              value={draft.macrosPer100.protein}
              estimate={aiAssisted}
              onChange={(v) => setMacro('protein', v)}
            />
            <NumberField
              label={t.carbsLabel}
              value={draft.macrosPer100.carbs}
              estimate={aiAssisted}
              onChange={(v) => setMacro('carbs', v)}
            />
            <NumberField
              label={t.fatLabel}
              value={draft.macrosPer100.fat}
              estimate={aiAssisted}
              onChange={(v) => setMacro('fat', v)}
            />
          </div>
          {aiAssisted && <p className="mt-2 text-[11px] text-muted-foreground">{t.aiEstimateHint}</p>}
        </div>
      )}

      <button type="button" onClick={onManual} className="self-start text-sm font-medium text-primary">
        {t.manualLink}
      </button>
    </div>
  );
}

function ManualMatch({ onPick, onBack }: { onPick: (r: IngredientSearchResult) => void; onBack: () => void }) {
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t.manualEyebrow}</span>
      <SearchPanel onSelect={onPick} />
      <button type="button" onClick={onBack} className="self-start text-sm font-medium text-primary">
        {t.manualBack}
      </button>
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
        <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-md border text-sm font-medium">
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="h-12 flex-[1.5] rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {label}
        </button>
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
