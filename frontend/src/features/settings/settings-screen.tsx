import { NutritionGoalForm } from './nutrition-goal-form';
import { de } from '../../i18n/de';

export function SettingsScreen() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold" role="heading">
        {de.settings.title}
      </h2>
      <NutritionGoalForm />
    </div>
  );
}
