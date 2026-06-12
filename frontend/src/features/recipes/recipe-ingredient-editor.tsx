import { useState } from 'react';
import type { RecipeIngredient } from '../../domain/recipes';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import { RecipeIngredientPicker } from './recipe-ingredient-picker';
import { isMassUnit, type MeasurementMode, modeOf, seedMode } from './measurement-mode';
import { Pencil } from 'lucide-react';
import { de, formatMacroTriplet } from '../../i18n/de';

const DISPLAY_QUANTITY_UNIT_LABEL_MAX = 24;
const NOTE_MAX_LENGTH = 80;

interface Props {
  ingredients: RecipeIngredient[];
  onChange: (next: RecipeIngredient[]) => void;
  /** Indices whose `gramsPerPiece` came from an AI estimate; cleared once the user edits the value. */
  estimateIndices?: ReadonlySet<number>;
  onEstimateAcknowledged?: (index: number) => void;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function RecipeIngredientEditor({ ingredients, onChange, estimateIndices, onEstimateAcknowledged }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  // Rows whose note editor the user opened this session; rows with a stored note are always open.
  const [openNotes, setOpenNotes] = useState<ReadonlySet<number>>(new Set());

  const isPickerOpen = pickerOpen || replacingIndex !== null;
  const pickerMode: 'add' | 'replace' = replacingIndex !== null ? 'replace' : 'add';

  function closePicker() {
    setPickerOpen(false);
    setReplacingIndex(null);
  }

  function handleReplace(index: number, result: IngredientSearchResult) {
    const existing = ingredients[index];
    if (!existing) return;
    const next: RecipeIngredient = {
      name: result.name,
      unit: result.unit,
      macrosPerUnit: result.macrosPerUnit,
      amount: existing.amount,
    };
    const newUnitIsMass = result.unit === 'g' || result.unit === 'ml';
    if (newUnitIsMass && existing.pieceQuantity) {
      next.pieceQuantity = existing.pieceQuantity;
    }
    if (result.untracked === true) {
      next.untracked = true;
    }
    onChange(ingredients.map((ing, i) => (i === index ? next : ing)));
    if (estimateIndices?.has(index)) {
      onEstimateAcknowledged?.(index);
    }
  }

  function handleRemove(index: number) {
    onChange(ingredients.filter((_, i) => i !== index));
  }

  function update(index: number, mapper: (ing: RecipeIngredient) => RecipeIngredient) {
    onChange(ingredients.map((ing, i) => (i === index ? mapper(ing) : ing)));
  }

  function handleSetMode(index: number, mode: MeasurementMode) {
    update(index, (ing) => seedMode(ing, mode));
  }

  function handleEditMassAmount(index: number, nextAmount: number) {
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;
    update(index, (ing) => ({ ...ing, amount: nextAmount }));
  }

  function handleEditPieceCount(index: number, nextCount: number) {
    if (!Number.isFinite(nextCount) || nextCount <= 0) return;
    update(index, (ing) => {
      if (!ing.pieceQuantity) return ing;
      const nextAmount = round1(nextCount * ing.pieceQuantity.gramsPerPiece);
      return {
        ...ing,
        amount: nextAmount,
        pieceQuantity: { ...ing.pieceQuantity, amount: nextCount },
      };
    });
  }

  function handleEditGramsPerPiece(index: number, nextGrams: number) {
    if (!Number.isFinite(nextGrams) || nextGrams <= 0) return;
    update(index, (ing) => {
      if (!ing.pieceQuantity) return ing;
      const nextAmount = round1(ing.pieceQuantity.amount * nextGrams);
      return {
        ...ing,
        amount: nextAmount,
        pieceQuantity: { ...ing.pieceQuantity, gramsPerPiece: nextGrams },
      };
    });
    onEstimateAcknowledged?.(index);
  }

  function handleEditUnitLabel(index: number, nextLabel: string) {
    update(index, (ing) =>
      ing.pieceQuantity ? { ...ing, pieceQuantity: { ...ing.pieceQuantity, unitLabel: nextLabel } } : ing,
    );
  }

  function handleEditFreeAmount(index: number, nextAmount: number) {
    if (!Number.isFinite(nextAmount) || nextAmount < 0) return;
    update(index, (ing) =>
      ing.displayQuantity
        ? { ...ing, displayQuantity: { ...ing.displayQuantity, amount: nextAmount } }
        : { ...ing, amount: nextAmount },
    );
  }

  function handleEditFreeUnit(index: number, raw: string) {
    update(index, (ing) => {
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        const next: RecipeIngredient = { ...ing };
        if (next.displayQuantity) {
          next.amount = next.displayQuantity.amount;
          delete next.displayQuantity;
        }
        return next;
      }
      const amount = ing.displayQuantity?.amount ?? ing.amount;
      return { ...ing, displayQuantity: { amount, unitLabel: raw } };
    });
  }

  function handleEditNote(index: number, raw: string) {
    update(index, (ing) => {
      const next: RecipeIngredient = { ...ing };
      if (raw.trim().length === 0) {
        delete next.note;
      } else {
        next.note = raw;
      }
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {de.recipeIngredientEditor.title}
          {ingredients.length > 0 && <span className="text-muted-foreground"> · {ingredients.length}</span>}
        </h3>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-md border px-3 py-1 text-xs"
          aria-label={de.recipeIngredientEditor.addAria}
        >
          {de.recipeIngredientEditor.add}
        </button>
      </div>

      {ingredients.length === 0 ? (
        <p className="text-sm text-muted-foreground">{de.recipeIngredientEditor.empty}</p>
      ) : (
        <ul className="divide-y">
          {ingredients.map((ing, idx) => {
            const mode = modeOf(ing);
            const massAllowed = isMassUnit(ing.unit);
            const isEstimate = mode === 'piece' && (estimateIndices?.has(idx) ?? false);
            const untracked = mode === 'free';

            return (
              <li
                key={`${ing.name}|${ing.unit}|${idx}`}
                data-untracked={untracked || undefined}
                className={`space-y-2 py-2 text-sm ${untracked ? 'text-muted-foreground' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReplacingIndex(idx)}
                    aria-label={de.recipeIngredientEditor.replaceAria(ing.name)}
                    data-testid={`replace-row-${idx}`}
                    className="-ml-1 inline-flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left font-medium hover:bg-muted/40 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:h-9"
                  >
                    <span className="min-w-0 truncate">{ing.name}</span>
                    <span aria-hidden className="shrink-0 text-xs text-muted-foreground/50">
                      ↻
                    </span>
                  </button>
                  {!(ing.note !== undefined || openNotes.has(idx)) && (
                    <button
                      type="button"
                      onClick={() => setOpenNotes((cur) => new Set(cur).add(idx))}
                      aria-label={de.recipeIngredientEditor.addNoteAria(ing.name)}
                      className="shrink-0 text-xs text-muted-foreground/70 hover:text-foreground"
                    >
                      {de.recipeIngredientEditor.addNote}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    aria-label={de.recipeIngredientEditor.remove(ing.name)}
                    className="-mr-1 inline-flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-destructive sm:h-8 sm:w-8"
                  >
                    ✕
                  </button>
                </div>

                <ModeSegments
                  name={ing.name}
                  mode={mode}
                  massAllowed={massAllowed}
                  onSelect={(m) => handleSetMode(idx, m)}
                />

                {mode === 'weight' && (
                  <div className="flex items-center gap-2 pl-1">
                    <input
                      aria-label={de.recipeIngredientEditor.amountFor(ing.name)}
                      type="number"
                      step="1"
                      value={ing.amount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) handleEditMassAmount(idx, v);
                      }}
                      className="h-10 w-24 rounded-md border px-2 text-right text-base sm:h-9 sm:py-1 sm:text-sm"
                    />
                    <span className="text-xs text-muted-foreground">{ing.unit}</span>
                  </div>
                )}

                {mode === 'piece' && ing.pieceQuantity && (
                  <div className="flex flex-wrap items-center gap-2 pl-1 text-xs text-muted-foreground">
                    <input
                      aria-label={de.recipeIngredientEditor.pieceCountFor(ing.name)}
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min={0}
                      value={ing.pieceQuantity.amount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) handleEditPieceCount(idx, v);
                      }}
                      className="w-16 rounded-md border px-2 py-1 text-right text-base sm:text-sm"
                    />
                    <input
                      aria-label={de.recipeIngredientEditor.pieceLabelFor(ing.name)}
                      type="text"
                      value={ing.pieceQuantity.unitLabel}
                      placeholder={de.recipeIngredientEditor.pieceLabelPlaceholder}
                      onChange={(e) => handleEditUnitLabel(idx, e.target.value)}
                      className="min-w-0 flex-1 rounded-md border px-2 py-1 text-base sm:text-sm"
                    />
                    <span aria-hidden>×</span>
                    <span className="whitespace-nowrap">{de.recipeIngredientEditor.perPiecePrefix}</span>
                    <input
                      aria-label={de.recipeIngredientEditor.gramsPerPieceFor(ing.name)}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min={0}
                      value={ing.pieceQuantity.gramsPerPiece}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) handleEditGramsPerPiece(idx, v);
                      }}
                      className="w-20 rounded-md border px-2 py-1 text-right text-base sm:text-sm"
                    />
                    <span className="text-xs">{ing.unit}/Stk</span>
                    {isEstimate && (
                      <span
                        data-testid={`piece-estimate-${idx}`}
                        className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      >
                        {de.recipeIngredientEditor.estimateBadge}
                      </span>
                    )}
                  </div>
                )}

                {mode === 'free' && (
                  <div className="space-y-1 pl-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <input
                        aria-label={de.recipeIngredientEditor.displayQuantityAmountAria(ing.name)}
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min={0}
                        value={ing.displayQuantity?.amount ?? ing.amount}
                        placeholder={de.recipeIngredientEditor.freeAmountPlaceholder}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v)) handleEditFreeAmount(idx, v);
                        }}
                        className="w-20 rounded-md border px-2 py-1 text-right text-base sm:text-sm"
                      />
                      <input
                        aria-label={de.recipeIngredientEditor.displayQuantityUnitAria(ing.name)}
                        type="text"
                        maxLength={DISPLAY_QUANTITY_UNIT_LABEL_MAX}
                        value={ing.displayQuantity?.unitLabel ?? ''}
                        placeholder={de.recipeIngredientEditor.freeUnitPlaceholder}
                        onChange={(e) => handleEditFreeUnit(idx, e.target.value)}
                        className="min-w-0 flex-1 rounded-md border px-2 py-1 text-base sm:text-sm"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground/80">{de.recipeIngredientEditor.freeCaption}</p>
                  </div>
                )}

                {mode !== 'free' && (
                  <div data-testid={`row-macros-${idx}`} className="pl-1 text-xs text-muted-foreground">
                    {Math.round(ing.macrosPerUnit.calories * ing.amount)} kcal ·{' '}
                    {formatMacroTriplet(
                      ing.macrosPerUnit.protein * ing.amount,
                      ing.macrosPerUnit.carbs * ing.amount,
                      ing.macrosPerUnit.fat * ing.amount,
                    )}
                  </div>
                )}

                {(ing.note !== undefined || openNotes.has(idx)) && (
                  <div className="flex items-center gap-1.5 pl-1">
                    <Pencil size={12} aria-hidden="true" className="shrink-0 text-muted-foreground/50" />
                    <input
                      aria-label={de.recipeIngredientEditor.noteAriaFor(ing.name)}
                      data-testid={`ingredient-note-${idx}`}
                      type="text"
                      maxLength={NOTE_MAX_LENGTH}
                      value={ing.note ?? ''}
                      placeholder={de.recipeIngredientEditor.notePlaceholder}
                      onFocus={() => setOpenNotes((cur) => (cur.has(idx) ? cur : new Set(cur).add(idx)))}
                      onChange={(e) => handleEditNote(idx, e.target.value)}
                      onBlur={(e) => {
                        const trimmed = e.target.value.trim();
                        if (trimmed !== e.target.value) handleEditNote(idx, trimmed);
                      }}
                      className="min-w-0 flex-1 bg-transparent text-xs italic text-muted-foreground placeholder:not-italic placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleEditNote(idx, '');
                        setOpenNotes((cur) => {
                          const next = new Set(cur);
                          next.delete(idx);
                          return next;
                        });
                      }}
                      aria-label={de.recipeIngredientEditor.removeNoteAria(ing.name)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-xs text-muted-foreground/60 hover:text-destructive"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <RecipeIngredientPicker
        open={isPickerOpen}
        mode={pickerMode}
        onClose={closePicker}
        onPicked={(ing) => onChange([...ingredients, ing])}
        onPickResult={(result) => {
          if (replacingIndex !== null) handleReplace(replacingIndex, result);
        }}
      />
    </div>
  );
}

interface ModeSegmentsProps {
  name: string;
  mode: MeasurementMode;
  massAllowed: boolean;
  onSelect: (mode: MeasurementMode) => void;
}

function ModeSegments({ name, mode, massAllowed, onSelect }: ModeSegmentsProps) {
  const segments: { key: MeasurementMode; label: string; disabled?: boolean }[] = [
    { key: 'weight', label: de.recipeIngredientEditor.modeWeight },
    { key: 'piece', label: de.recipeIngredientEditor.modePiece, disabled: !massAllowed },
    { key: 'free', label: de.recipeIngredientEditor.modeFree },
  ];

  return (
    <div
      role="group"
      aria-label={de.recipeIngredientEditor.modeGroupAria(name)}
      className="flex gap-1 rounded-md bg-muted p-[3px]"
    >
      {segments.map((seg) => {
        const active = seg.key === mode;
        return (
          <button
            key={seg.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={seg.label}
            disabled={seg.disabled}
            onClick={() => onSelect(seg.key)}
            // Transition `color` only — flipping background/shadow instantly avoids the stuck-segment bug.
            style={{ transition: 'color 150ms' }}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted-foreground'
            }`}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
