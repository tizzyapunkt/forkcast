import { NutritionGoalForm } from './nutrition-goal-form';
import { useAuth } from '../auth/use-auth';
import { de } from '../../i18n/de';

export function SettingsScreen() {
  const { logout } = useAuth();

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold" role="heading">
        {de.settings.title}
      </h2>
      <NutritionGoalForm />
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
  );
}
