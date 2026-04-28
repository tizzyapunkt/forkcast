import { useState } from 'react';
import type { MealSlot } from '../../domain/meal-log';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import { useScrollLock } from '../../hooks/use-scroll-lock';
import { QuickEntryForm } from './quick-entry-form';
import { SearchPanel } from './search-panel';
import { RecentPanel } from './recent-panel';
import { FullEntryConfirm } from './full-entry-confirm';

type Tab = 'search' | 'recent' | 'quick';
type Step = 'search' | 'confirm';

interface LogIngredientDrawerProps {
  open: boolean;
  slot: MealSlot | null;
  date: string;
  onClose: () => void;
}

export function LogIngredientDrawer({ open, slot, date, onClose }: LogIngredientDrawerProps) {
  const [tab, setTab] = useState<Tab>('search');
  const [step, setStep] = useState<Step>('search');
  const [selected, setSelected] = useState<IngredientSearchResult | null>(null);

  useScrollLock(open && slot !== null);

  if (!open || !slot) return null;

  function handleClose() {
    setTab('search');
    setStep('search');
    setSelected(null);
    onClose();
  }

  function handleSelect(result: IngredientSearchResult) {
    setSelected(result);
    setStep('confirm');
  }

  function handleBack() {
    setStep('search');
    setSelected(null);
  }

  function handleTabChange(next: Tab) {
    setTab(next);
    setStep('search');
    setSelected(null);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log ingredient"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-x-hidden overflow-y-auto rounded-t-xl bg-background shadow-lg"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="flex min-w-0 items-center justify-between gap-2 px-4 pt-3 pb-1">
          <h2 className="min-w-0 truncate text-sm font-semibold">
            Add to {slot}
            {step === 'confirm' && selected ? ` — ${selected.name}` : ''}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        <div className="flex gap-4 border-b px-4 text-sm">
          <button
            onClick={() => handleTabChange('search')}
            className={`pb-2 ${tab === 'search' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
          >
            Search
          </button>
          <button
            onClick={() => handleTabChange('recent')}
            className={`pb-2 ${tab === 'recent' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
          >
            Recent
          </button>
          <button
            onClick={() => handleTabChange('quick')}
            className={`pb-2 ${tab === 'quick' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
          >
            Quick
          </button>
        </div>

        {tab === 'quick' && <QuickEntryForm date={date} slot={slot} onSuccess={handleClose} />}

        {tab === 'search' && step === 'search' && <SearchPanel onSelect={handleSelect} />}

        {tab === 'recent' && step === 'search' && <RecentPanel onSelect={handleSelect} />}

        {step === 'confirm' && selected && (
          <FullEntryConfirm result={selected} date={date} slot={slot} onSuccess={handleClose} onBack={handleBack} />
        )}
      </div>
    </>
  );
}
