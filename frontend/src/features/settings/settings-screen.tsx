import { NutritionGoalForm } from './nutrition-goal-form';

export function SettingsScreen() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-base font-semibold" role="heading">
        Nutrition goal
      </h2>
      <NutritionGoalForm />
    </div>
  );
}
