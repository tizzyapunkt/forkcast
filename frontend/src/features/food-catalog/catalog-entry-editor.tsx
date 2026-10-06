import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { DecimalInput } from '../../components/ui/decimal-input';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { locale, t } from '../../i18n';
import {
  catalogDisplayName,
  toEditableEntry,
  type CatalogEntry,
  type CatalogEntryDraft,
  type CatalogPieceWeight,
} from '../../domain/food-catalog';
import type { MacrosPerUnit } from '../../domain/meal-log';
import { useDraftCatalogEntry } from '../../queries/use-catalog';
import { fold } from '../../lib/fold';

const copy = t.catalog;

const ZERO_MACROS: MacrosPerUnit = { calories: 0, protein: 0, carbs: 0, fat: 0 };

const UNIT_OPTIONS = [
  { value: 'g' as const, label: 'g' },
  { value: 'ml' as const, label: 'ml' },
];

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
      setLocalError(copy.aiFillNeedsName);
      return;
    }
    setLocalError(null);
    fill.mutate(name, {
      onSuccess: (entry) => {
        const filled = toEditableEntry(entry);
        // The user's typed name wins over the model's canonical form only when they
        // already committed to one; everything else is a suggestion they can edit.
        // A name typed in English is the English name: the canonical one stays German.
        const typedEnglish = (typed: string) =>
          filled.nameEn !== undefined && fold(typed.trim()) === fold(filled.nameEn);
        setDraft((d) => ({
          ...d,
          name: d.name.trim().length > 0 && !typedEnglish(d.name) ? d.name : filled.name,
          nameEn: d.nameEn?.trim() ? d.nameEn : filled.nameEn,
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
    const { nameEn, ...rest } = draft;
    const english = nameEn?.trim() ?? '';
    onSave({
      ...rest,
      name: draft.name.trim(),
      ...(english.length > 0 ? { nameEn: english } : {}),
      synonyms: parseSynonyms(synonymsText),
    });
  }

  const setPiece = (index: number, patch: Partial<CatalogPieceWeight>) =>
    setDraft((d) => ({
      ...d,
      pieces: (d.pieces ?? []).map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));

  const shownError = localError ?? (fill.isError ? copy.aiFillError : null) ?? error;

  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label={copy.nameLabel}>
        <Input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          aria-label={copy.nameLabel}
          placeholder={copy.namePlaceholder}
          className="h-11 w-full py-0 font-medium"
        />
      </Field>

      <Field label={copy.nameEnLabel} hint={copy.nameEnHint}>
        <Input
          value={draft.nameEn ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, nameEn: e.target.value }))}
          aria-label={copy.nameEnLabel}
          placeholder={copy.nameEnPlaceholder}
          className="h-11 w-full py-0"
        />
      </Field>

      <div className="flex flex-col gap-1">
        <Button
          variant="outline"
          onClick={runFill}
          disabled={fill.isPending}
          className="self-start border-dashed border-primary/60 py-1.5 px-3 text-primary"
        >
          {fill.isPending ? copy.aiFilling : copy.aiFill}
        </Button>
        <span className="text-[11px] text-muted-foreground">{copy.aiFillHint}</span>
      </div>

      <Field label={copy.synonymsLabel} hint={copy.synonymsHint}>
        <Input
          value={synonymsText}
          onChange={(e) => setSynonymsText(e.target.value)}
          aria-label={copy.synonymsLabel}
          className="h-11 w-full py-0"
        />
      </Field>

      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="mb-1 block text-sm font-medium">{copy.unitLabel}</span>
          <SegmentedControl
            label={copy.unitLabel}
            value={draft.unit}
            onChange={(unit) => setDraft((d) => ({ ...d, unit }))}
            options={UNIT_OPTIONS}
          />
        </div>
        <label className="flex items-center gap-2 pb-1 text-sm">
          <input
            type="checkbox"
            checked={untracked}
            onChange={(e) => setDraft((d) => ({ ...d, untracked: e.target.checked || undefined }))}
            aria-label={copy.untrackedToggle}
            className="h-4 w-4 rounded-sm"
          />
          {copy.untrackedToggle}
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">
          {copy.macrosLabel}{' '}
          <span className="text-xs font-normal text-muted-foreground">· {copy.macrosPer(draft.unit)}</span>
        </span>
        <div className="grid grid-cols-4 gap-2">
          <MacroField
            label={copy.kcalLabel}
            value={draft.macrosPer100.calories}
            estimate={estimated}
            onChange={(v) => setMacro('calories', v)}
          />
          <MacroField
            label={copy.proteinLabel}
            value={draft.macrosPer100.protein}
            estimate={estimated}
            onChange={(v) => setMacro('protein', v)}
          />
          <MacroField
            label={copy.carbsLabel}
            value={draft.macrosPer100.carbs}
            estimate={estimated}
            onChange={(v) => setMacro('carbs', v)}
          />
          <MacroField
            label={copy.fatLabel}
            value={draft.macrosPer100.fat}
            estimate={estimated}
            onChange={(v) => setMacro('fat', v)}
          />
        </div>
        {estimated && <p className="mt-2 text-[11px] text-muted-foreground">{copy.aiEstimateHint}</p>}
        {untracked && <p className="mt-2 text-[11px] text-muted-foreground">{copy.untrackedHint}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{copy.piecesLabel}</span>
        <span className="-mt-1 text-[11px] text-muted-foreground">{copy.piecesHint}</span>
        {(draft.pieces ?? []).map((piece, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={piece.label}
              onChange={(e) => setPiece(index, { label: e.target.value })}
              aria-label={copy.pieceLabelAria(index + 1)}
              placeholder={copy.pieceLabelPlaceholder}
              size="sm"
              className="h-10 flex-1"
            />
            <DecimalInput
              value={piece.grams}
              onValueChange={(v: number | null) => setPiece(index, { grams: v ?? 0 })}
              aria-label={copy.pieceGramsAria(index + 1)}
              numeric
              size="sm"
              className="h-10 w-24"
            />
            <Button
              variant="outline"
              onClick={() =>
                setDraft((d) => {
                  const next = (d.pieces ?? []).filter((_, i) => i !== index);
                  return { ...d, pieces: next.length > 0 ? next : undefined };
                })
              }
              aria-label={copy.removePiece(piece.label)}
              className="shrink-0 px-2 py-1.5 text-muted-foreground"
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => setDraft((d) => ({ ...d, pieces: [...(d.pieces ?? []), { label: '', grams: 0 }] }))}
          className="self-start p-0"
        >
          {copy.addPiece}
        </Button>
      </div>

      {shownError && <p className="text-sm text-destructive">{shownError}</p>}
      {duplicateAction}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="h-12 flex-1 py-0">
          {copy.cancel}
        </Button>
        <Button onClick={submit} disabled={pending} className="h-12 flex-[1.5] py-0 font-semibold">
          {pending ? copy.saving : copy.save}
        </Button>
      </div>

      {onDelete && entry && (
        <Button
          variant="ghost"
          onClick={onDelete}
          aria-label={copy.deleteAria(catalogDisplayName(entry, locale))}
          className="self-start p-0 text-destructive hover:text-destructive/80"
        >
          {copy.delete}
        </Button>
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
        onValueChange={(v: number | null) => onChange(v ?? 0)}
        aria-label={label}
        numeric
        size="sm"
        className="h-10 w-full"
      />
    </label>
  );
}
