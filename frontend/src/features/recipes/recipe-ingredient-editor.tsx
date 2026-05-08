import { useState } from 'react';
import type { PieceQuantity, RecipeIngredient } from '../../domain/recipes';
import { RecipeIngredientPicker } from './recipe-ingredient-picker';
import { de } from '../../i18n/de';

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
  const [pendingDetach, setPendingDetach] = useState<{ index: number; nextAmount: number } | null>(null);
  const [addingPieceFor, setAddingPieceFor] = useState<number | null>(null);

  function handleRemove(index: number) {
    onChange(ingredients.filter((_, i) => i !== index));
  }

  function update(index: number, mapper: (ing: RecipeIngredient) => RecipeIngredient) {
    onChange(ingredients.map((ing, i) => (i === index ? mapper(ing) : ing)));
  }

  function handleEditMassAmount(index: number, nextAmount: number) {
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;
    const ing = ingredients[index];
    if (!ing) return;
    if (ing.pieceQuantity) {
      setPendingDetach({ index, nextAmount });
      return;
    }
    update(index, (i) => ({ ...i, amount: nextAmount }));
  }

  function confirmDetach() {
    if (!pendingDetach) return;
    const { index, nextAmount } = pendingDetach;
    update(index, (ing) => {
      const next: RecipeIngredient = { ...ing, amount: nextAmount };
      delete next.pieceQuantity;
      return next;
    });
    setPendingDetach(null);
  }

  function cancelDetach() {
    setPendingDetach(null);
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

  function handleAttachPiece(index: number, draft: PieceQuantity) {
    update(index, (ing) => {
      if (ing.unit !== 'g' && ing.unit !== 'ml') return ing;
      const nextAmount = round1(draft.amount * draft.gramsPerPiece);
      return { ...ing, amount: nextAmount, pieceQuantity: draft };
    });
    setAddingPieceFor(null);
  }

  function handleDetachPiece(index: number) {
    update(index, (ing) => {
      const next: RecipeIngredient = { ...ing };
      delete next.pieceQuantity;
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{de.recipeIngredientEditor.title}</h3>
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
            const piece = ing.pieceQuantity;
            const isEstimate = piece !== undefined && (estimateIndices?.has(idx) ?? false);
            const massEditable = ing.unit === 'g' || ing.unit === 'ml';
            const showAddPiece = !piece && massEditable && addingPieceFor !== idx;

            return (
              <li key={`${ing.name}|${ing.unit}|${idx}`} className="space-y-2 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{ing.name}</span>
                  <input
                    aria-label={de.recipeIngredientEditor.amountFor(ing.name)}
                    type="number"
                    step="1"
                    value={ing.amount}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) handleEditMassAmount(idx, v);
                    }}
                    className="w-20 rounded-md border px-2 py-1 text-right text-sm"
                  />
                  <span className="w-10 text-xs text-muted-foreground">{ing.unit}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    aria-label={de.recipeIngredientEditor.remove(ing.name)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>

                {piece && (
                  <div className="flex flex-wrap items-center gap-2 pl-2 text-xs text-muted-foreground">
                    <input
                      aria-label={de.recipeIngredientEditor.pieceCountFor(ing.name)}
                      type="number"
                      step="0.5"
                      min={0}
                      value={piece.amount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) handleEditPieceCount(idx, v);
                      }}
                      className="w-16 rounded-md border px-2 py-1 text-right text-sm"
                    />
                    <input
                      aria-label={de.recipeIngredientEditor.pieceLabelFor(ing.name)}
                      type="text"
                      value={piece.unitLabel}
                      placeholder={de.recipeIngredientEditor.pieceLabelPlaceholder}
                      onChange={(e) => handleEditUnitLabel(idx, e.target.value)}
                      className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
                    />
                    <span aria-hidden>×</span>
                    <input
                      aria-label={de.recipeIngredientEditor.gramsPerPieceFor(ing.name)}
                      type="number"
                      step="1"
                      min={0}
                      value={piece.gramsPerPiece}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) handleEditGramsPerPiece(idx, v);
                      }}
                      className="w-20 rounded-md border px-2 py-1 text-right text-sm"
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
                    <button
                      type="button"
                      onClick={() => handleDetachPiece(idx)}
                      aria-label={de.recipeIngredientEditor.detachPieceAria(ing.name)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {de.recipeIngredientEditor.detachPiece}
                    </button>
                  </div>
                )}

                {showAddPiece && (
                  <div className="pl-2">
                    <button
                      type="button"
                      onClick={() => setAddingPieceFor(idx)}
                      aria-label={de.recipeIngredientEditor.addPieceTrackingAria(ing.name)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {de.recipeIngredientEditor.addPieceTracking}
                    </button>
                  </div>
                )}

                {addingPieceFor === idx && (
                  <AttachPieceForm
                    ingredient={ing}
                    onAttach={(pq) => handleAttachPiece(idx, pq)}
                    onCancel={() => setAddingPieceFor(null)}
                  />
                )}

                {pendingDetach?.index === idx && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-700/60 dark:bg-amber-900/20">
                    <p>{de.recipeIngredientEditor.massEditDetachHint}</p>
                    <div className="mt-1 flex gap-2">
                      <button type="button" onClick={cancelDetach} className="rounded-md border px-2 py-0.5">
                        {de.recipeForm.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={confirmDetach}
                        className="rounded-md bg-destructive px-2 py-0.5 text-white"
                      >
                        {de.recipeIngredientEditor.detachPiece}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <RecipeIngredientPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPicked={(ing) => onChange([...ingredients, ing])}
      />
    </div>
  );
}

interface AttachPieceFormProps {
  ingredient: RecipeIngredient;
  onAttach: (pq: PieceQuantity) => void;
  onCancel: () => void;
}

function AttachPieceForm({ ingredient, onAttach, onCancel }: AttachPieceFormProps) {
  const [count, setCount] = useState<number>(1);
  const [label, setLabel] = useState<string>('');
  const [grams, setGrams] = useState<number>(ingredient.amount);

  const valid = count > 0 && grams > 0 && label.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 pl-2 text-xs">
      <input
        aria-label={de.recipeIngredientEditor.pieceCountFor(ingredient.name)}
        type="number"
        step="0.5"
        min={0}
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        className="w-16 rounded-md border px-2 py-1 text-right text-sm"
      />
      <input
        aria-label={de.recipeIngredientEditor.pieceLabelFor(ingredient.name)}
        type="text"
        value={label}
        placeholder={de.recipeIngredientEditor.pieceLabelPlaceholder}
        onChange={(e) => setLabel(e.target.value)}
        className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
      />
      <span aria-hidden>×</span>
      <input
        aria-label={de.recipeIngredientEditor.gramsPerPieceFor(ingredient.name)}
        type="number"
        step="1"
        min={0}
        value={grams}
        onChange={(e) => setGrams(Number(e.target.value))}
        className="w-20 rounded-md border px-2 py-1 text-right text-sm"
      />
      <span className="text-xs">{ingredient.unit}/Stk</span>
      <button
        type="button"
        disabled={!valid}
        onClick={() => onAttach({ amount: count, unitLabel: label.trim(), gramsPerPiece: grams })}
        className="rounded-md border px-2 py-0.5 disabled:opacity-50"
      >
        OK
      </button>
      <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
        {de.recipeForm.cancel}
      </button>
    </div>
  );
}
