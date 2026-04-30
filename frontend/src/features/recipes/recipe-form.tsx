import { useState } from 'react';
import type { Recipe, RecipeIngredient } from '../../domain/recipes';
import { ErrorBanner } from '../../components/app/error-banner';
import { RecipeIngredientEditor } from './recipe-ingredient-editor';
import { de } from '../../i18n/de';

interface Props {
  initial?: Recipe;
  submitLabel: string;
  isSubmitting: boolean;
  error?: Error | null;
  onCancel: () => void;
  onSubmit: (values: { name: string; yield: number; ingredients: RecipeIngredient[]; steps: string[] }) => void;
}

export function RecipeForm({ initial, submitLabel, isSubmitting, error, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [recipeYield, setRecipeYield] = useState<number>(initial?.yield ?? 1);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(initial?.ingredients ?? []);
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    if (name.trim().length === 0) {
      setValidationError(de.recipeForm.nameRequired);
      return;
    }
    if (!Number.isFinite(recipeYield) || recipeYield < 1) {
      setValidationError(de.recipeForm.yieldMin);
      return;
    }
    if (ingredients.length === 0) {
      setValidationError(de.recipeForm.minOneIngredient);
      return;
    }
    const trimmedSteps = steps.map((s) => s.trim()).filter((s) => s.length > 0);
    onSubmit({ name: name.trim(), yield: recipeYield, ingredients, steps: trimmedSteps });
  }

  function addStep() {
    setSteps([...steps, '']);
  }
  function updateStep(index: number, value: string) {
    setSteps(steps.map((s, i) => (i === index ? value : s)));
  }
  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }
  function moveStep(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const tmp = next[target];
    next[target] = next[index] as string;
    next[index] = tmp as string;
    setSteps(next);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      {error && <ErrorBanner error={error} />}
      {validationError && <p className="text-sm text-destructive">{validationError}</p>}

      <div className="space-y-1">
        <label htmlFor="recipe-name" className="text-sm font-medium">
          {de.recipeForm.name}
        </label>
        <input
          id="recipe-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder={de.recipeForm.namePlaceholder}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="recipe-yield" className="text-sm font-medium">
          {de.recipeForm.yield}
        </label>
        <input
          id="recipe-yield"
          type="number"
          min={1}
          step={1}
          value={recipeYield}
          onChange={(e) => setRecipeYield(Number(e.target.value))}
          className="w-24 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <RecipeIngredientEditor ingredients={ingredients} onChange={setIngredients} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{de.recipeForm.steps}</h3>
          <button type="button" onClick={addStep} className="rounded-md border px-3 py-1 text-xs">
            {de.recipeForm.addStep}
          </button>
        </div>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{de.recipeForm.noStepsOptional}</p>
        ) : (
          <ol className="space-y-2">
            {steps.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="pt-2 text-xs text-muted-foreground">{idx + 1}.</span>
                <textarea
                  aria-label={de.recipeForm.stepAria(idx + 1)}
                  value={s}
                  onChange={(e) => updateStep(idx, e.target.value)}
                  className="min-h-[3rem] flex-1 rounded-md border px-3 py-2 text-sm"
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={de.recipeForm.moveStepUp(idx + 1)}
                    onClick={() => moveStep(idx, -1)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={de.recipeForm.moveStepDown(idx + 1)}
                    onClick={() => moveStep(idx, 1)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={de.recipeForm.removeStep(idx + 1)}
                    onClick={() => removeStep(idx)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-md border px-4 py-2 text-sm">
          {de.recipeForm.cancel}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isSubmitting ? de.recipeForm.saving : submitLabel}
        </button>
      </div>
    </form>
  );
}
