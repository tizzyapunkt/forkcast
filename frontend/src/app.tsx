import { useState } from 'react';
import { BottomNav, type AppView } from './components/app/bottom-nav';
import { DailyLogScreen } from './features/daily-log/daily-log-screen';
import { useActiveDate } from './features/date-nav/use-active-date';
import { SettingsScreen } from './features/settings/settings-screen';
import { RecipesScreen } from './features/recipes/recipes-screen';
import { PlannerScreen } from './features/planner/planner-screen';

export function App() {
  const [view, setView] = useState<AppView>('log');
  const [settingsInitialView, setSettingsInitialView] = useState<'main' | 'weight-tracker'>('main');
  const [recipeSubScreen, setRecipeSubScreen] = useState(false);
  const { date, goPrev, goNext, goToday } = useActiveDate();

  function openWeightTracker() {
    setSettingsInitialView('weight-tracker');
    setView('settings');
  }

  function changeView(next: AppView) {
    if (next === 'settings') setSettingsInitialView('main');
    if (next !== 'recipes') setRecipeSubScreen(false);
    setView(next);
  }

  // Hide the bottom nav while inside a recipe sub-screen (detail / editor / import) for focus.
  const navHidden = view === 'recipes' && recipeSubScreen;

  return (
    <div className="flex min-h-screen flex-col">
      <main className={`flex-1 ${navHidden ? 'pb-safe-b' : 'pb-nav-safe'}`}>
        {view === 'log' && (
          <DailyLogScreen
            date={date}
            onPrev={goPrev}
            onNext={goNext}
            onToday={goToday}
            onOpenWeightTracker={openWeightTracker}
          />
        )}
        {view === 'planner' && <PlannerScreen />}
        {view === 'recipes' && <RecipesScreen onSubScreenChange={setRecipeSubScreen} />}
        {view === 'settings' && <SettingsScreen initialView={settingsInitialView} />}
      </main>
      {!navHidden && <BottomNav active={view} onChange={changeView} />}
    </div>
  );
}
