import { useState } from 'react';
import { DecimalInput } from '../../components/app/decimal-input';
import { de } from '../../i18n/de';
import type { CatalogEntry, CatalogEntryDraft, CatalogPieceWeight } from '../../domain/food-catalog';
import type { MacrosPerUnit } from '../../domain/meal-log';
import { useDraftCatalogEntry } from '../../queries/use-catalog';

const t = de.catalog;

const ZERO_MACROS: MacrosPerUnit = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function emptyDraft(): CatalogEntryDraft {
  return { name: '', synonyms: [], unit: 'g', macrosPer100: { ...ZERO_MACROS } };
}

interface CatalogEntryEditorProps {
  /** The entry being edited, or null when creating. */
  entry: CatalogEntry | null;
  onSave: (draft: CatalogEntryDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
  pending?: boolean;
  /** Server-side rejection (validation, duplicate) rendered inline above the actions. */
  error?: string | null;
  /** Rendered under the error when the name collides with an existing entry. */
  duplicateAction?: React.ReactNode;
}

/**
 * The one editor for a catalog entry, used for both create and edit. Local state
 * holds the in-progress draft, so a rejected save re-renders with the user's
 * input intact rather than reverting to the stored entry.
 */
export function CatalogEntryEditor({
  entry,
  onSave,
  onCancel,
  onDelete,
  pending = false,
  error = null,
  duplicateAction,
}: CatalogEntryEditorProps) {
  const [draft, setDraft] = useState<CatalogEntryDraft>(() => (entry ? structuredClone(entry) : emptyDraft()));
  const [synonymsText, setSynonymsText] = useState(() => (entry ? entry.synonyms.join(', ') : ''));
  const [estimated, setEstimated] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fill = useDraftCatalogEntry();

  const untracked = draft.untracked === true;

  const setMacro = (key: keyof MacrosPerUnit, value: number) =>
    setDraft((d) => ({ ...d, macrosPer100: { ...d.macrosPer100, [key]: value } }));

  const parseSynonyms = (text: string): string[] =>
    text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  function runFill() {
    const name = draft.name.trim();
    if (name.length === 0) {
      setLocalError(t.aiFillNeedsName);
      return;
    }
    setLocalError(null);
    fill.mutate(name, {
      onSuccess: (filled) => {
        // The user's typed name wins over the model's canonical form only when they
        // already committed to one; everything else is a suggestion they can edit.
        setDraft((d) => ({
          ...d,
          name: d.name.trim().length > 0 ? d.name : filled.name,
          unit: filled.unit,
          synonyms: filled.synonyms,
          macrosPer100: filled.macrosPer100,
          untracked: filled.untracked === true ? true : undefined,
          pieces: filled.pieces,
          density: filled.density,
        }));
        setSynonymsText(filled.synonyms.join(', '));
        setEstimated(true);
      },
    });
  }

  function submit() {
    setLocalError(null);
    onSave({ ...draft, name: draft.name.trim(), synonyms: parseSynonyms(synonymsText) });
  }

  const setPiece = (index: number, patch: Partial<CatalogPieceWeight>) =>
    setDraft((d) => ({
      ...d,
      pieces: (d.pieces ?? []).map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));

  const shownError = localError ?? (fill.isError ? t.aiFillError : null) ?? error;

  return (
    <div className="flex flex-col gap-4 p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t.nameLabel}</span>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          aria-label={t.nameLabel}
          placeholder={t.namePlaceholder}
          className="h-11 w-full rounded-md border px-3 text-base font-medium sm:text-sm"
        />
      </label>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={runFill}
          disabled={fill.isPending}
          className="self-start rounded-md border border-dashed border-primary/60 px-3 py-1.5 text-sm font-medium text-primary disabled:opacity-60"
        >
          {fill.isPending ? t.aiFilling : t.aiFill}
        </button>
        <span className="text-[11px] text-muted-foreground">{t.aiFillHint}</span>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t.synonymsLabel}</span>
        <input
          value={synonymsText}
          onChange={(e) => setSynonymsText(e.target.value)}
          aria-label={t.synonymsLabel}
          className="h-11 w-full rounded-md border px-3 text-base sm:text-sm"
        />
        <span className="text-[11px] text-muted-foreground">{t.synonymsHint}</span>
      </label>

      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="mb-1 block text-sm font-medium">{t.unitLabel}</span>
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {(['g', 'ml'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, unit: u }))}
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
            checked={untracked}
            onChange={(e) => setDraft((d) => ({ ...d, untracked: e.target.checked || undefined }))}
            aria-label={t.untrackedToggle}
            className="h-4 w-4 rounded"
          />
          {t.untrackedToggle}
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">
          {t.macrosLabel} <span className="text-xs font-normal text-muted-foreground">· {t.macrosPer(draft.unit)}</span>
        </span>
        <div className="grid grid-cols-4 gap-2">
          <MacroField
            label={t.kcalLabel}
            value={draft.macrosPer100.calories}
            estimate={estimated}
            onChange={(v) => setMacro('calories', v)}
          />
          <MacroField
            label={t.proteinLabel}
            value={draft.macrosPer100.protein}
            estimate={estimated}
            onChange={(v) => setMacro('protein', v)}
          />
          <MacroField
            label={t.carbsLabel}
            value={draft.macrosPer100.carbs}
            estimate={estimated}
            onChange={(v) => setMacro('carbs', v)}
          />
          <MacroField
            label={t.fatLabel}
            value={draft.macrosPer100.fat}
            estimate={estimated}
            onChange={(v) => setMacro('fat', v)}
          />
        </div>
        {estimated && <p className="mt-2 text-[11px] text-muted-foreground">{t.aiEstimateHint}</p>}
        {untracked && <p className="mt-2 text-[11px] text-muted-foreground">{t.untrackedHint}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t.piecesLabel}</span>
        <span className="-mt-1 text-[11px] text-muted-foreground">{t.piecesHint}</span>
        {(draft.pieces ?? []).map((piece, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={piece.label}
              onChange={(e) => setPiece(index, { label: e.target.value })}
              aria-label={t.pieceLabelAria(index + 1)}
              placeholder={t.pieceLabelPlaceholder}
              className="h-10 min-w-0 flex-1 rounded-md border px-2 text-sm"
            />
            <DecimalInput
              value={piece.grams}
              onValueChange={(v) => setPiece(index, { grams: v ?? 0 })}
              aria-label={t.pieceGramsAria(index + 1)}
              className="h-10 w-24 rounded-md border px-2 text-right text-sm"
            />
            <button
              type="button"
              onClick={() =>
                setDraft((d) => {
                  const next = (d.pieces ?? []).filter((_, i) => i !== index);
                  return { ...d, pieces: next.length > 0 ? next : undefined };
                })
              }
              aria-label={t.removePiece(piece.label)}
              className="shrink-0 rounded-md border px-2 py-1.5 text-sm text-muted-foreground"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, pieces: [...(d.pieces ?? []), { label: '', grams: 0 }] }))}
          className="self-start text-sm font-medium text-primary"
        >
          {t.addPiece}
        </button>
      </div>

      {shownError && <p className="text-sm text-destructive">{shownError}</p>}
      {duplicateAction}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-md border text-sm font-medium">
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-12 flex-[1.5] rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? t.saving : t.save}
        </button>
      </div>

      {onDelete && entry && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t.deleteAria(entry.name)}
          className="self-start text-sm font-medium text-destructive"
        >
          {t.delete}
        </button>
      )}
    </div>
  );
}

function MacroField({
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
        onValueChange={(v) => onChange(v ?? 0)}
        aria-label={label}
        className="h-10 w-full rounded-md border px-2 text-right text-sm"
      />
    </label>
  );
}
