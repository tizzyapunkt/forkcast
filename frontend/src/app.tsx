import { useState } from 'react';
import { AppHeader } from './components/app/app-header';
import { BottomNav, type AppView } from './components/app/bottom-nav';
import { DailyLogScreen } from './features/daily-log/daily-log-screen';
import { DayTotalsHeader } from './features/daily-log/day-totals-header';
import { DateNav } from './features/date-nav/date-nav';
import { useActiveDate } from './features/date-nav/use-active-date';
import { SettingsScreen } from './features/settings/settings-screen';
import { RecipesScreen } from './features/recipes/recipes-screen';
import { useDailyLog } from './queries/use-daily-log';
import { useNutritionGoal } from './queries/use-nutrition-goal';
import type { DayTotals } from './domain/meal-log';

const ZERO_TOTALS: DayTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  macrosPartial: false,
};

export function App() {
  const [view, setView] = useState<AppView>('log');
  const { date, goPrev, goNext, goToday } = useActiveDate();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader bottom={view === 'log' ? <LogHeaderBottom date={date} /> : null}>
        {view === 'log' && <DateNav date={date} onPrev={goPrev} onNext={goNext} onToday={goToday} />}
      </AppHeader>
      <main className="flex-1 pb-16">
        {view === 'log' && <DailyLogScreen date={date} />}
        {view === 'recipes' && <RecipesScreen />}
        {view === 'settings' && <SettingsScreen />}
      </main>
      <BottomNav active={view} onChange={setView} />
    </div>
  );
}

function LogHeaderBottom({ date }: { date: string }) {
  const { data: log } = useDailyLog(date);
  const { data: goal } = useNutritionGoal();
  return <DayTotalsHeader totals={log?.totals ?? ZERO_TOTALS} goal={goal ?? null} />;
}
