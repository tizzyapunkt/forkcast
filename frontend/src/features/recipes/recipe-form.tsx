import { useState } from 'react';
import type { IngredientMatchProvenance, Recipe, RecipeIngredient } from '../../domain/recipes';
import { AppHeader } from '../../components/app/app-header';
import { ErrorBanner } from '../../components/app/error-banner';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { RecipeIngredientEditor } from './recipe-ingredient-editor';
import { PerPortionHero } from './per-portion-hero';
import { de } from '../../i18n/de';

interface Props {
  initial?: Recipe;
  submitLabel: string;
  isSubmitting: boolean;
  error?: Error | null;
  onCancel: () => void;
  onSubmit: (values: { name: string; yield: number; ingredients: RecipeIngredient[]; steps: string[] }) => void;
  /** When provided, ingredient state is controlled by the parent (used by AI recipe import). */
  ingredients?: RecipeIngredient[];
  onIngredientsChange?: (next: RecipeIngredient[]) => void;
  /** Title shown with a header back-arrow (chevron-left) that invokes `onCancel`. Omitted when a custom `headerSlot` is given. */
  title?: string;
  headerSlot?: React.ReactNode;
  /** Indices whose `gramsPerPiece` came from an AI estimate; the editor renders an estimate badge for them. */
  estimateIndices?: ReadonlySet<number>;
  onEstimateAcknowledged?: (index: number) => void;
  /** Import-match provenance per row, parallel to `ingredients` (AI recipe import only). */
  provenance?: ReadonlyArray<IngredientMatchProvenance | undefined>;
}

export function RecipeForm({
  initial,
  submitLabel,
  isSubmitting,
  error,
  onCancel,
  onSubmit,
  ingredients: controlledIngredients,
  onIngredientsChange,
  title,
  headerSlot,
  estimateIndices,
  onEstimateAcknowledged,
  provenance,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [recipeYield, setRecipeYield] = useState<number>(initial?.yield ?? 1);
  const [internalIngredients, setInternalIngredients] = useState<RecipeIngredient[]>(initial?.ingredients ?? []);
  const ingredients = controlledIngredients ?? internalIngredients;
  const setIngredients = onIngredientsChange ?? setInternalIngredients;
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
    const normalizedIngredients = ingredients.map((ing) => {
      if (ing.note === undefined) return ing;
      const trimmed = ing.note.trim();
      if (trimmed.length === 0) {
        const { note: _omit, ...rest } = ing;
        return rest;
      }
      if (trimmed === ing.note) return ing;
      return { ...ing, note: trimmed };
    });
    onSubmit({ name: name.trim(), yield: recipeYield, ingredients: normalizedIngredients, steps: trimmedSteps });
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
    <>
      {title && <AppHeader title={title} onBack={onCancel} backAria={de.recipeForm.backAria} />}
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {headerSlot}
        {error && <ErrorBanner error={error} />}
        {validationError && <p className="text-sm text-destructive">{validationError}</p>}

        <Field label={de.recipeForm.name} htmlFor="recipe-name">
          <Input
            id="recipe-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
            placeholder={de.recipeForm.namePlaceholder}
          />
        </Field>

        <PerPortionHero
          ingredients={ingredients}
          servings={recipeYield}
          onServingsChange={(next) => setRecipeYield(next)}
        />

        <RecipeIngredientEditor
          ingredients={ingredients}
          onChange={setIngredients}
          estimateIndices={estimateIndices}
          onEstimateAcknowledged={onEstimateAcknowledged}
          provenance={provenance}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{de.recipeForm.steps}</h3>
            <Button variant="outline" size="sm" onClick={addStep}>
              {de.recipeForm.addStep}
            </Button>
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
                    className="min-h-[3rem] min-w-0 flex-1 rounded-md border px-3 py-2 text-base sm:text-sm"
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
          <Button variant="outline" onClick={onCancel} className="flex-1">
            {de.recipeForm.cancel}
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? de.recipeForm.saving : submitLabel}
          </Button>
        </div>
      </form>
    </>
  );
}
