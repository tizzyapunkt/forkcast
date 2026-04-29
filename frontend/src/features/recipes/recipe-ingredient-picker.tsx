import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useScrollLock } from '../../hooks/use-scroll-lock';
import { SearchPanel } from '../log-ingredient/search-panel';
import { RecentPanel } from '../log-ingredient/recent-panel';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { RecipeIngredient } from '../../domain/recipes';

interface Props {
  open: boolean;
  onClose: () => void;
  onPicked: (ingredient: RecipeIngredient) => void;
}

type Tab = 'search' | 'recent';
type Step = { kind: 'pick' } | { kind: 'amount'; result: IngredientSearchResult };

const amountSchema = z.object({
  amount: z.coerce.number({ invalid_type_error: 'Amount must be a number' }).positive('Amount must be greater than 0'),
});
type AmountForm = z.infer<typeof amountSchema>;

export function RecipeIngredientPicker({ open, onClose, onPicked }: Props) {
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
    setStep({ kind: 'amount', result });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add ingredient to recipe"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-x-hidden overflow-y-auto rounded-t-xl bg-background shadow-lg"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="flex min-w-0 items-center justify-between gap-2 px-4 pt-3 pb-1">
          <h2 className="min-w-0 truncate text-sm font-semibold">
            {step.kind === 'pick' ? 'Add ingredient' : `Amount — ${step.result.name}`}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        {step.kind === 'pick' && (
          <>
            <div className="flex gap-4 border-b px-4 text-sm">
              <button
                onClick={() => setTab('search')}
                className={`pb-2 ${tab === 'search' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
              >
                Search
              </button>
              <button
                onClick={() => setTab('recent')}
                className={`pb-2 ${tab === 'recent' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
              >
                Recent
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
              onPicked({
                name: step.result.name,
                unit: step.result.unit,
                macrosPerUnit: step.result.macrosPerUnit,
                amount,
              });
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

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v.amount))} className="space-y-4 p-4">
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        per {result.unit} — {result.macrosPerUnit.calories} kcal · {result.macrosPerUnit.protein}g P ·{' '}
        {result.macrosPerUnit.carbs}g C · {result.macrosPerUnit.fat}g F
      </div>
      <div className="space-y-1">
        <label htmlFor="amount" className="text-sm font-medium">
          Amount per recipe ({result.unit})
        </label>
        <input
          id="amount"
          type="number"
          step="1"
          {...register('amount')}
          className="w-full rounded-md border px-3 py-2 text-sm"
          autoFocus
          placeholder="e.g. 100"
        />
        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="flex-1 rounded-md border px-4 py-2 text-sm">
          Back
        </button>
        <button
          type="submit"
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Add
        </button>
      </div>
    </form>
  );
}
