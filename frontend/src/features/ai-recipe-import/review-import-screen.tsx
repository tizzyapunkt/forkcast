import { useMemo, useState } from 'react';
import { useAddRecipe } from '../../queries/use-add-recipe';
import { RecipeForm } from '../recipes/recipe-form';
import { RecipeIngredientPicker } from '../recipes/recipe-ingredient-picker';
import type {
  DraftIngredient,
  MatchedDraftIngredient,
  RecipeDraft,
  RecipeIngredient,
  UnmatchedDraftIngredient,
} from '../../domain/recipes';
import { de } from '../../i18n/de';

interface Props {
  draft: RecipeDraft;
  onSaved: () => void;
  onCancel: () => void;
}

interface OverriddenInfo {
  extractedUnit: string;
}

function isMatched(ing: DraftIngredient): ing is MatchedDraftIngredient {
  return ing.matched;
}

function buildInitialMatchedIngredients(draft: RecipeDraft): {
  matched: RecipeIngredient[];
  overrideMap: Map<number, OverriddenInfo>;
} {
  const matched: RecipeIngredient[] = [];
  const overrideMap = new Map<number, OverriddenInfo>();
  draft.ingredients.forEach((ing) => {
    if (!isMatched(ing)) return;
    const idx = matched.length;
    matched.push({
      name: ing.name,
      unit: ing.unit,
      macrosPerUnit: ing.macrosPerUnit,
      amount: ing.amount ?? 0,
    });
    if (ing.unitOverridden) {
      overrideMap.set(idx, { extractedUnit: ing.unit });
    }
  });
  return { matched, overrideMap };
}

export function ReviewImportScreen({ draft, onSaved, onCancel }: Props) {
  const initial = useMemo(() => buildInitialMatchedIngredients(draft), [draft]);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(initial.matched);
  const [unmatched, setUnmatched] = useState<UnmatchedDraftIngredient[]>(() =>
    draft.ingredients.filter((i): i is UnmatchedDraftIngredient => !i.matched),
  );
  const [pickerForName, setPickerForName] = useState<string | null>(null);
  const addMutation = useAddRecipe();

  function resolveUnmatched(name: string, picked: RecipeIngredient) {
    setIngredients((prev) => [...prev, picked]);
    setUnmatched((prev) => prev.filter((u) => u.name !== name));
    setPickerForName(null);
  }

  function discardUnmatched(name: string) {
    setUnmatched((prev) => prev.filter((u) => u.name !== name));
  }

  const initialRecipe = useMemo(
    () => ({
      id: '',
      name: draft.name,
      yield: draft.yield,
      ingredients: initial.matched,
      steps: draft.steps,
      createdAt: '',
      updatedAt: '',
    }),
    [draft, initial.matched],
  );

  const headerSlot =
    unmatched.length > 0 ? (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/60 dark:bg-amber-900/20">
        <p className="font-medium">{de.aiRecipeImport.unmatchedHeading(unmatched.length)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{de.aiRecipeImport.unmatchedHint}</p>
        <ul className="mt-2 space-y-1">
          {unmatched.map((u) => (
            <li key={u.name} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{u.name}</span>
                {u.amount !== null || u.unit !== null ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {u.amount ?? '—'} {u.unit ?? ''}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => setPickerForName(u.name)}
                aria-label={de.aiRecipeImport.resolveUnmatchedAria(u.name)}
                className="rounded-md border px-2 py-0.5 text-xs"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => discardUnmatched(u.name)}
                aria-label={de.aiRecipeImport.discardUnmatchedAria(u.name)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <>
      <RecipeForm
        initial={initialRecipe}
        ingredients={ingredients}
        onIngredientsChange={setIngredients}
        submitLabel={de.recipes.create}
        isSubmitting={addMutation.isPending}
        error={addMutation.error}
        onCancel={onCancel}
        headerSlot={headerSlot}
        onSubmit={(values) =>
          addMutation.mutate(values, {
            onSuccess: () => onSaved(),
          })
        }
      />

      {/* Render override hints + the picker for unmatched resolution */}
      {initial.overrideMap.size > 0 && (
        <ul className="space-y-1 px-4 pb-2 text-xs text-muted-foreground">
          {ingredients.map((ing, idx) => {
            const override = initial.overrideMap.get(idx);
            if (!override) return null;
            return (
              <li
                key={`override-${idx}`}
                aria-label={de.aiRecipeImport.unitOverriddenAria}
                data-testid={`unit-override-${idx}`}
              >
                {ing.name}: {de.aiRecipeImport.unitOverridden(override.extractedUnit, ing.unit)}
              </li>
            );
          })}
        </ul>
      )}

      <RecipeIngredientPicker
        open={pickerForName !== null}
        onClose={() => setPickerForName(null)}
        onPicked={(picked) => {
          if (pickerForName) resolveUnmatched(pickerForName, picked);
        }}
      />
    </>
  );
}
