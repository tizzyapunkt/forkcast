import { useState } from 'react';
import type { MealSlot } from '../../domain/meal-log';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { Recipe } from '../../domain/recipes';
import { BottomSheet } from '../../components/app/bottom-sheet';
import { de, slotLabelsDe } from '../../i18n/de';
import { QuickEntryForm } from './quick-entry-form';
import { SearchPanel } from './search-panel';
import { RecentPanel } from './recent-panel';
import { RecipePanel } from './recipe-panel';
import { FullEntryConfirm } from './full-entry-confirm';
import { RecipeConfirm } from './recipe-confirm';

type Tab = 'search' | 'recent' | 'recipes' | 'quick';
type Step =
  | { kind: 'search' }
  | { kind: 'confirm'; result: IngredientSearchResult; defaultAmount?: number }
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

  if (!open || !slot) return null;

  function handleClose() {
    setTab('search');
    setStep({ kind: 'search' });
    onClose();
  }

  function handleSelect(result: IngredientSearchResult) {
    setStep({ kind: 'confirm', result });
  }

  function handleRecentSelect(result: IngredientSearchResult, defaultAmount: number) {
    setStep({ kind: 'confirm', result, defaultAmount });
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

  const slotLabel = slotLabelsDe[slot];

  const headerSuffix =
    step.kind === 'confirm' ? ` — ${step.result.name}` : step.kind === 'recipe-confirm' ? ` — ${step.recipe.name}` : '';

  const drawerHeight = tab === 'quick' ? 'h-[55dvh]' : 'h-[82dvh]';

  return (
    <BottomSheet open onClose={handleClose} ariaLabel={de.logIngredient.dialogAria} heightClassName={drawerHeight}>
      <div className="shrink-0">
        <div className="flex min-w-0 items-center justify-between gap-2 px-4 pt-3 pb-1">
          <h2 className="min-w-0 truncate text-sm font-semibold">
            {de.logIngredient.addToSlot(slotLabel)}
            {headerSuffix}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            {de.logIngredient.cancel}
          </button>
        </div>

        <div className="flex gap-4 border-b px-4 text-sm">
          <button
            onClick={() => handleTabChange('search')}
            className={`pb-2 ${tab === 'search' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
          >
            {de.logIngredient.search}
          </button>
          <button
            onClick={() => handleTabChange('recent')}
            className={`pb-2 ${tab === 'recent' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
          >
            {de.logIngredient.recent}
          </button>
          <button
            onClick={() => handleTabChange('recipes')}
            className={`pb-2 ${tab === 'recipes' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
          >
            {de.logIngredient.recipesTab}
          </button>
          <button
            onClick={() => handleTabChange('quick')}
            className={`pb-2 ${tab === 'quick' ? 'border-b-2 border-primary-300 font-medium' : 'text-muted-foreground'}`}
          >
            {de.logIngredient.quick}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {tab === 'quick' && <QuickEntryForm date={date} slot={slot} onSuccess={handleClose} />}

        {tab === 'search' && step.kind === 'search' && <SearchPanel onSelect={handleSelect} disableUntracked />}
        {tab === 'recent' && step.kind === 'search' && <RecentPanel onSelect={handleRecentSelect} />}
        {tab === 'recipes' && step.kind === 'search' && <RecipePanel onSelect={handleRecipeSelect} />}

        {step.kind === 'confirm' && (
          <FullEntryConfirm
            result={step.result}
            date={date}
            slot={slot}
            defaultAmount={step.defaultAmount}
            onSuccess={handleClose}
            onBack={handleBack}
          />
        )}

        {step.kind === 'recipe-confirm' && (
          <RecipeConfirm recipe={step.recipe} date={date} slot={slot} onSuccess={handleClose} onBack={handleBack} />
        )}
      </div>
    </BottomSheet>
  );
}
