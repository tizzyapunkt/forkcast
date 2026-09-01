import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { MealSlot } from '../../domain/meal-log';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { Recipe } from '../../domain/recipes';
import { BottomSheet } from '../../components/app/bottom-sheet';
import { Button } from '../../components/ui/button';
import { de, slotLabelsDe } from '../../i18n/de';
import { QuickEntryForm } from './quick-entry-form';
import { SearchPanel } from './search-panel';
import { CreateFoodSheet } from '../ai-recipe-import/create-food-sheet';
import { RecentPanel } from './recent-panel';
import { FavoritesPanel } from './favorites-panel';
import { RecipePanel } from './recipe-panel';
import { FullEntryConfirm } from './full-entry-confirm';
import { RecipeConfirm } from './recipe-confirm';

type Tab = 'search' | 'favorites' | 'recent' | 'recipes' | 'quick';
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
  const [createQuery, setCreateQuery] = useState<string | null>(null);

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

  // A favorite the user has never logged has no amount to offer, so the confirm
  // step opens empty rather than guessing one.
  function handleFavoriteSelect(result: IngredientSearchResult, defaultAmount?: number) {
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
  const inSubStep = step.kind !== 'search';

  const drawerHeight = tab === 'quick' ? 'h-[55dvh]' : 'h-[82dvh]';

  return (
    <BottomSheet open onClose={handleClose} ariaLabel={de.logIngredient.dialogAria} heightClassName={drawerHeight}>
      <div className="shrink-0">
        <div className="flex min-w-0 items-center justify-between gap-2 px-4 pt-3 pb-1">
          <div className="flex min-w-0 items-center gap-1">
            {inSubStep && (
              <Button
                variant="ghost"
                size="iconSm"
                onClick={handleBack}
                aria-label={de.logIngredient.back}
                className="-ml-2"
              >
                <ChevronLeft size={22} aria-hidden="true" />
              </Button>
            )}
            <h2 className="min-w-0 truncate text-sm font-semibold">{de.logIngredient.addToSlot(slotLabel)}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            {de.logIngredient.cancel}
          </button>
        </div>

        {!inSubStep && (
          <div className="flex gap-4 overflow-x-auto border-b px-4 text-sm whitespace-nowrap">
            <button
              onClick={() => handleTabChange('search')}
              className={`shrink-0 pb-2 ${tab === 'search' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
            >
              {de.logIngredient.search}
            </button>
            <button
              onClick={() => handleTabChange('favorites')}
              className={`shrink-0 pb-2 ${tab === 'favorites' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
            >
              {de.logIngredient.favorites}
            </button>
            <button
              onClick={() => handleTabChange('recent')}
              className={`shrink-0 pb-2 ${tab === 'recent' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
            >
              {de.logIngredient.recent}
            </button>
            <button
              onClick={() => handleTabChange('recipes')}
              className={`shrink-0 pb-2 ${tab === 'recipes' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
            >
              {de.logIngredient.recipesTab}
            </button>
            <button
              onClick={() => handleTabChange('quick')}
              className={`shrink-0 pb-2 ${tab === 'quick' ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}
            >
              {de.logIngredient.quick}
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {tab === 'quick' && step.kind === 'search' && (
          <QuickEntryForm date={date} slot={slot} onSuccess={handleClose} />
        )}

        {tab === 'search' && step.kind === 'search' && (
          <SearchPanel onSelect={handleSelect} disableUntracked onCreate={setCreateQuery} />
        )}
        {tab === 'favorites' && step.kind === 'search' && (
          <FavoritesPanel onSelect={handleFavoriteSelect} showLastAmount />
        )}
        {tab === 'recent' && step.kind === 'search' && <RecentPanel onSelect={handleRecentSelect} />}
        {tab === 'recipes' && step.kind === 'search' && <RecipePanel onSelect={handleRecipeSelect} />}

        {step.kind === 'confirm' && (
          <FullEntryConfirm
            result={step.result}
            date={date}
            slot={slot}
            defaultAmount={step.defaultAmount}
            onSuccess={handleClose}
          />
        )}

        {step.kind === 'recipe-confirm' && (
          <RecipeConfirm recipe={step.recipe} date={date} slot={slot} onSuccess={handleClose} />
        )}
      </div>

      <CreateFoodSheet query={createQuery} onClose={() => setCreateQuery(null)} onCreated={handleSelect} />
    </BottomSheet>
  );
}
