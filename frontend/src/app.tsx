import { useEffect, useState } from 'react';
import { BottomNav, type AppView } from './components/app/bottom-nav';
import { DailyLogScreen } from './features/daily-log/daily-log-screen';
import { useActiveDate } from './features/date-nav/use-active-date';
import { SettingsScreen } from './features/settings/settings-screen';
import { RecipesScreen } from './features/recipes/recipes-screen';
import { PlannerScreen } from './features/planner/planner-screen';
import { CookingScreen } from './features/cooking-session/cooking-screen';
import { cookingSearch, parseCookingSearch, type CookingSession } from './features/cooking-session/cooking-url';

export function App() {
  // A cooking session in the URL (a reload mid-cooking) reopens the cooking view over the planner.
  const [cooking, setCooking] = useState<CookingSession | null>(() => parseCookingSearch(window.location.search));
  const [view, setView] = useState<AppView>(() => (cooking ? 'planner' : 'log'));
  const [plannerWeek, setPlannerWeek] = useState<string | undefined>(() => cooking?.weekStart);
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

  useEffect(() => {
    const { pathname, search } = window.location;
    if (cooking) window.history.replaceState(window.history.state, '', pathname + cookingSearch(cooking));
    else if (new URLSearchParams(search).has('cook')) window.history.replaceState(window.history.state, '', pathname);
  }, [cooking]);

  function leaveCooking() {
    setPlannerWeek(cooking?.weekStart);
    setCooking(null);
    setView('planner');
  }

  // Hide the bottom nav while inside a sub-screen (recipe detail / editor / import, cooking) for focus.
  const navHidden = cooking !== null || (view === 'recipes' && recipeSubScreen);

  return (
    // overflow-x-clip: the full-bleed header spans 100vw, which includes a classic scrollbar's width.
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {/* Every screen is phone-shaped; on a desktop it stays a readable centred column. */}
      <main className={`mx-auto w-full max-w-2xl flex-1 ${navHidden ? 'pb-safe-b' : 'pb-nav-safe'}`}>
        {!cooking && view === 'log' && (
          <DailyLogScreen
            date={date}
            onPrev={goPrev}
            onNext={goNext}
            onToday={goToday}
            onOpenWeightTracker={openWeightTracker}
          />
        )}
        {cooking && <CookingScreen session={cooking} onSessionChange={setCooking} onBack={leaveCooking} />}
        {!cooking && view === 'planner' && (
          <PlannerScreen
            key={plannerWeek}
            initialWeekStart={plannerWeek}
            onCook={(recipeId, weekStart) => setCooking({ recipeId, weekStart, batches: null, extra: 0 })}
          />
        )}
        {!cooking && view === 'recipes' && <RecipesScreen onSubScreenChange={setRecipeSubScreen} />}
        {!cooking && view === 'settings' && <SettingsScreen initialView={settingsInitialView} />}
      </main>
      {!navHidden && <BottomNav active={view} onChange={changeView} />}
    </div>
  );
}
