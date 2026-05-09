import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useScrollLock } from '../../hooks/use-scroll-lock';
import { SearchPanel } from '../log-ingredient/search-panel';
import { RecentPanel } from '../log-ingredient/recent-panel';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { RecipeIngredient } from '../../domain/recipes';
import { de } from '../../i18n/de';

type PickerMode = 'add' | 'replace';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when the user completes the add flow (search → amount step). Used in `'add'` mode. */
  onPicked: (ingredient: RecipeIngredient) => void;
  /** Picker mode. `'add'` (default) runs the full search + amount flow. `'replace'` skips the
   * amount step and hands the raw `IngredientSearchResult` to `onPickResult`; the parent merges
   * it with the row's existing amount. */
  mode?: PickerMode;
  /** Called when a result is picked in `'replace'` mode. Required when `mode === 'replace'`. */
  onPickResult?: (result: IngredientSearchResult) => void;
}

type Tab = 'search' | 'recent';
type Step = { kind: 'pick' } | { kind: 'amount'; result: IngredientSearchResult };

const amountSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: de.recipeIngredientPicker.validation.amountNumber })
    .positive(de.recipeIngredientPicker.validation.amountPositive),
});
type AmountForm = z.infer<typeof amountSchema>;

export function RecipeIngredientPicker({ open, onClose, onPicked, mode = 'add', onPickResult }: Props) {
  const [tab, setTab] = useState<Tab>('search');
  const [step, setStep] = useState<Step>({ kind: 'pick' });

  useScrollLock(open);

  if (!open) return null;

  function handleClose() {
    setTab('search');
    setStep({ kind: 'pick' });
    onClose();
  }

  function handleSelect(result: IngredientSearchResult) {
    if (mode === 'replace') {
      onPickResult?.(result);
      handleClose();
      return;
    }
    setStep({ kind: 'amount', result });
  }

  const titleText =
    step.kind === 'amount'
      ? de.recipeIngredientPicker.titleAmount(step.result.name)
      : mode === 'replace'
        ? de.recipeIngredientPicker.titleReplace
        : de.recipeIngredientPicker.titlePick;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={de.recipeIngredientPicker.dialogAria}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-x-hidden overflow-y-auto rounded-t-xl bg-background shadow-lg"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="flex min-w-0 items-center justify-between gap-2 px-4 pt-3 pb-1">
          <h2 className="min-w-0 truncate text-sm font-semibold">{titleText}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            {de.recipeIngredientPicker.cancel}
          </button>
        </div>

        {step.kind === 'pick' && (
          <>
            <div className="flex gap-4 border-b px-4 text-sm">
              <button
                type="button"
                onClick={() => setTab('search')}
                className={`pb-2 ${tab === 'search' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
              >
                {de.recipeIngredientPicker.search}
              </button>
              <button
                type="button"
                onClick={() => setTab('recent')}
                className={`pb-2 ${tab === 'recent' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
              >
                {de.recipeIngredientPicker.recent}
              </button>
            </div>

            {tab === 'search' && <SearchPanel onSelect={handleSelect} />}
            {tab === 'recent' && <RecentPanel onSelect={handleSelect} />}
          </>
        )}

        {step.kind === 'amount' && (
          <AmountStep
            result={step.result}
            onBack={() => setStep({ kind: 'pick' })}
            onSubmit={(amount) => {
              const ingredient: RecipeIngredient = {
                name: step.result.name,
                unit: step.result.unit,
                macrosPerUnit: step.result.macrosPerUnit,
                amount,
              };
              if (step.result.untracked === true) ingredient.untracked = true;
              onPicked(ingredient);
              handleClose();
            }}
          />
        )}
      </div>
    </>
  );
}

function AmountStep({
  result,
  onBack,
  onSubmit,
}: {
  result: IngredientSearchResult;
  onBack: () => void;
  onSubmit: (amount: number) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AmountForm>({ resolver: zodResolver(amountSchema) });

  const submit = handleSubmit((v) => onSubmit(v.amount));

  // Use a div, not a nested <form>. The picker is rendered inside RecipeForm's <form>,
  // and HTML disallows form nesting — in real browsers this caused the picker's submit
  // button to submit the outer recipe form (navigating to ?amount=…). Submit on Enter
  // is preserved by handling keydown on the input.
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        {de.recipeIngredientPicker.perUnit(
          result.unit,
          result.macrosPerUnit.calories,
          result.macrosPerUnit.protein,
          result.macrosPerUnit.carbs,
          result.macrosPerUnit.fat,
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="amount" className="text-sm font-medium">
          {de.recipeIngredientPicker.amountLabel(result.unit)}
        </label>
        <input
          id="amount"
          type="number"
          inputMode="decimal"
          step="1"
          {...register('amount')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              void submit();
            }
          }}
          className="h-12 w-full rounded-md border px-3 text-base sm:h-10 sm:text-sm"
          autoFocus
          placeholder={de.recipeIngredientPicker.amountPlaceholder}
        />
        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="h-11 flex-1 rounded-md border px-4 text-sm sm:h-10">
          {de.recipeIngredientPicker.back}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          className="h-11 flex-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:h-10"
        >
          {de.recipeIngredientPicker.add}
        </button>
      </div>
    </div>
  );
}
