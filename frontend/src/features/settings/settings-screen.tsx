import { useState, lazy, Suspense } from 'react';
import { AppHeader } from '../../components/app/app-header';
import { NutritionGoalForm } from './nutrition-goal-form';
import { BodyProfileForm } from '../body-profile/body-profile-form';
import { CatalogPanel } from './catalog-panel';
import { CatalogManagerScreen } from '../food-catalog/catalog-manager-screen';
import { DiagnosticsScreen } from '../diagnostics/diagnostics-screen';
import { useAuth } from '../auth/use-auth';
import { de } from '../../i18n/de';
import { Button } from '../../components/ui/button';

// Lazy: recharts (weight-chart) only downloads once the user opens the tracker,
// instead of shipping in every settings-screen bundle.
const WeightTrackerScreen = lazy(() =>
  import('../weight-log/weight-tracker-screen').then((m) => ({ default: m.WeightTrackerScreen })),
);

type View = 'main' | 'weight-tracker' | 'catalog' | 'diagnostics';

interface SettingsScreenProps {
  initialView?: View;
}

export function SettingsScreen({ initialView = 'main' }: SettingsScreenProps = {}) {
  const [view, setView] = useState<View>(initialView);
  const { logout } = useAuth();

  if (view === 'weight-tracker') {
    return (
      <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">{de.weightLog.loading}</p>}>
        <WeightTrackerScreen onBack={() => setView('main')} />
      </Suspense>
    );
  }

  if (view === 'catalog') {
    return <CatalogManagerScreen onBack={() => setView('main')} />;
  }

  if (view === 'diagnostics') {
    return <DiagnosticsScreen onBack={() => setView('main')} />;
  }

  return (
    <>
      <AppHeader title={de.nav.settings} />
      <div className="space-y-4 p-4">
        <h2 className="text-base font-semibold" role="heading">
          {de.settings.title}
        </h2>
        <NutritionGoalForm />
        <BodyProfileForm />
        <CatalogPanel onManage={() => setView('catalog')} />
        <button
          type="button"
          onClick={() => setView('weight-tracker')}
          className="flex w-full items-center justify-between rounded-md border border-input bg-card px-4 py-3 text-left text-sm hover:bg-accent"
        >
          <span>
            <span className="font-medium">{de.weightLog.settingsLink}</span>
            <span className="ml-2 text-xs text-muted-foreground">{de.weightLog.settingsLinkHint}</span>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          onClick={() => setView('diagnostics')}
          className="flex w-full items-center justify-between rounded-md border border-input bg-card px-4 py-3 text-left text-sm hover:bg-accent"
        >
          <span>
            <span className="font-medium">{de.diagnostics.settingsLink}</span>
            <span className="ml-2 text-xs text-muted-foreground">{de.diagnostics.settingsLinkHint}</span>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <div className="pt-4">
          <Button variant="destructiveOutline" onClick={() => logout()} className="w-full">
            {de.auth.logout}
          </Button>
        </div>
      </div>
    </>
  );
}
