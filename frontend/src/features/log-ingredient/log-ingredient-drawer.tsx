import { useState } from 'react';
import type { MealSlot } from '../../domain/meal-log';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { Recipe } from '../../domain/recipes';
import { useScrollLock } from '../../hooks/use-scroll-lock';
import { QuickEntryForm } from './quick-entry-form';
import { SearchPanel } from './search-panel';
import { RecentPanel } from './recent-panel';
import { RecipePanel } from './recipe-panel';
import { FullEntryConfirm } from './full-entry-confirm';
import { RecipeConfirm } from './recipe-confirm';

type Tab = 'search' | 'recent' | 'recipes' | 'quick';
type Step =
  | { kind: 'search' }
  | { kind: 'confirm'; result: IngredientSearchResult }
  | { kind: 'recipe-confirm'; recipe: Recipe };

interface LogIngredientDrawerProps {
  open: boolean;
  slot: MealSlot | null;
  date: string;
  onClose: () => void;
}

export function LogIngredientDrawer({ open, slot, date, onClose }: LogIngredientDrawerProps) {
  const [tab, setTab] = useState<Tab>('search');
  const [step, setStep] = useState<Step>({ kind: 'search' });

  useScrollLock(open && slot !== null);

  if (!open || !slot) return null;

  function handleClose() {
    setTab('search');
    setStep({ kind: 'search' });
    onClose();
  }

  function handleSelect(result: IngredientSearchResult) {
    setStep({ kind: 'confirm', result });
  }

  function handleRecipeSelect(recipe: Recipe) {
    setStep({ kind: 'recipe-confirm', recipe });
  }

  function handleBack() {
    setStep({ kind: 'search' });
  }

  function handleTabChange(next: Tab) {
    setTab(next);
    setStep({ kind: 'search' });
  }

  const headerSuffix =
    step.kind === 'confirm' ? ` — ${step.result.name}` : step.kind === 'recipe-confirm' ? ` — ${step.recipe.name}` : '';

  const drawerHeight = tab === 'quick' ? 'h-[55dvh]' : 'h-[82dvh]';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log ingredient"
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-xl bg-background shadow-lg transition-[height] duration-200 ${drawerHeight}`}
      >
        <div className="shrink-0">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
          <div className="flex min-w-0 items-center justify-between gap-2 px-4 pt-3 pb-1">
            <h2 className="min-w-0 truncate text-sm font-semibold">
              Add to {slot}
              {headerSuffix}
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
              onClick={() => handleTabChange('recipes')}
              className={`pb-2 ${tab === 'recipes' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
            >
              Recipes
            </button>
            <button
              onClick={() => handleTabChange('quick')}
              className={`pb-2 ${tab === 'quick' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
            >
              Quick
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {tab === 'quick' && <QuickEntryForm date={date} slot={slot} onSuccess={handleClose} />}

          {tab === 'search' && step.kind === 'search' && <SearchPanel onSelect={handleSelect} />}
          {tab === 'recent' && step.kind === 'search' && <RecentPanel onSelect={handleSelect} />}
          {tab === 'recipes' && step.kind === 'search' && <RecipePanel onSelect={handleRecipeSelect} />}

          {step.kind === 'confirm' && (
            <FullEntryConfirm result={step.result} date={date} slot={slot} onSuccess={handleClose} onBack={handleBack} />
          )}

          {step.kind === 'recipe-confirm' && (
            <RecipeConfirm recipe={step.recipe} date={date} slot={slot} onSuccess={handleClose} onBack={handleBack} />
          )}
        </div>
      </div>
    </>
  );
}
