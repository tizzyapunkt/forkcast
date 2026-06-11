import { useState } from 'react';
import { AppHeader } from '../../components/app/app-header';
import { NutritionGoalForm } from './nutrition-goal-form';
import { BodyProfileForm } from '../body-profile/body-profile-form';
import { WeightTrackerScreen } from '../weight-log/weight-tracker-screen';
import { UnmatchedIngredientsPanel } from '../unmatched-ingredients/unmatched-ingredients-panel';
import { useAuth } from '../auth/use-auth';
import { de } from '../../i18n/de';

type View = 'main' | 'weight-tracker';

interface SettingsScreenProps {
  initialView?: View;
}

export function SettingsScreen({ initialView = 'main' }: SettingsScreenProps = {}) {
  const [view, setView] = useState<View>(initialView);
  const { logout } = useAuth();

  if (view === 'weight-tracker') {
    return <WeightTrackerScreen onBack={() => setView('main')} />;
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
        <UnmatchedIngredientsPanel />
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
        <div className="pt-4">
          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            {de.auth.logout}
          </button>
        </div>
      </div>
    </>
  );
}
