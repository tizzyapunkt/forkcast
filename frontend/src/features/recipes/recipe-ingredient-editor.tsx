import { useState } from 'react';
import type { RecipeIngredient } from '../../domain/recipes';
import { RecipeIngredientPicker } from './recipe-ingredient-picker';

interface Props {
  ingredients: RecipeIngredient[];
  onChange: (next: RecipeIngredient[]) => void;
}

export function RecipeIngredientEditor({ ingredients, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleRemove(index: number) {
    onChange(ingredients.filter((_, i) => i !== index));
  }

  function handleUpdateAmount(index: number, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    onChange(ingredients.map((ing, i) => (i === index ? { ...ing, amount } : ing)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Ingredients</h3>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-md border px-3 py-1 text-xs"
          aria-label="Add ingredient"
        >
          + Add
        </button>
      </div>

      {ingredients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ingredients yet.</p>
      ) : (
        <ul className="divide-y">
          {ingredients.map((ing, idx) => (
            <li key={`${ing.name}|${ing.unit}|${idx}`} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{ing.name}</span>
              <input
                aria-label={`Amount for ${ing.name}`}
                type="number"
                step="1"
                defaultValue={ing.amount}
                onBlur={(e) => handleUpdateAmount(idx, Number(e.target.value))}
                className="w-20 rounded-md border px-2 py-1 text-right text-sm"
              />
              <span className="w-10 text-xs text-muted-foreground">{ing.unit}</span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                aria-label={`Remove ${ing.name}`}
                className="text-muted-foreground hover:text-destructive"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <RecipeIngredientPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPicked={(ing) => onChange([...ingredients, ing])}
      />
    </div>
  );
}
