import { useState } from 'react';
import { ErrorBanner } from '../../components/app/error-banner';
import { de } from '../../i18n/de';
import type { ProductDraft } from '../../api/extract-product-from-photos';

interface Props {
  draft: ProductDraft;
  isSaving: boolean;
  error?: unknown;
  onBack: () => void;
  onConfirm: (edited: ProductDraft) => void;
}

function parseNonNegative(value: string): number {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const fieldClass =
  'w-full rounded-md border px-3 py-2 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus';

/** Editable review of an extracted product — the user corrects AI misreads before saving. */
export function ProductReviewForm({ draft, isSaving, error, onBack, onConfirm }: Props) {
  const [name, setName] = useState(draft.name);
  const [unit, setUnit] = useState<'g' | 'ml'>(draft.unit);
  const [calories, setCalories] = useState(String(draft.macrosPer100.calories));
  const [protein, setProtein] = useState(String(draft.macrosPer100.protein));
  const [carbs, setCarbs] = useState(String(draft.macrosPer100.carbs));
  const [fat, setFat] = useState(String(draft.macrosPer100.fat));

  const trimmedName = name.trim();
  const normalizedError = error instanceof Error ? error : error ? new Error(String(error)) : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (trimmedName.length === 0) return;
    onConfirm({
      barcode: draft.barcode,
      name: trimmedName,
      unit,
      macrosPer100: {
        calories: parseNonNegative(calories),
        protein: parseNonNegative(protein),
        carbs: parseNonNegative(carbs),
        fat: parseNonNegative(fat),
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-label={de.productCapture.back}
        >
          ← {de.productCapture.back}
        </button>
        <h2 className="text-base font-semibold">{de.productCapture.reviewTitle}</h2>
        <span className="w-12" />
      </div>

      <p className="text-sm text-muted-foreground">{de.productCapture.reviewHint}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{de.productCapture.nameLabel}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={de.productCapture.nameLabel}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{de.productCapture.unitLabel}</span>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as 'g' | 'ml')}
          aria-label={de.productCapture.unitLabel}
          className={fieldClass}
        >
          <option value="g">g</option>
          <option value="ml">ml</option>
        </select>
      </label>

      <p className="text-xs font-medium text-muted-foreground">{de.productCapture.per100(unit)}</p>

      <div className="grid grid-cols-2 gap-3">
        {(
          [
            [de.productCapture.caloriesLabel, calories, setCalories],
            [de.productCapture.proteinLabel, protein, setProtein],
            [de.productCapture.carbsLabel, carbs, setCarbs],
            [de.productCapture.fatLabel, fat, setFat],
          ] as const
        ).map(([label, value, setter]) => (
          <label key={label} className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={value}
              onChange={(e) => setter(e.target.value)}
              aria-label={label}
              className={fieldClass}
            />
          </label>
        ))}
      </div>

      {normalizedError && <ErrorBanner error={normalizedError} />}

      <button
        type="submit"
        disabled={isSaving || trimmedName.length === 0}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isSaving ? de.productCapture.saving : de.productCapture.save}
      </button>
    </form>
  );
}
