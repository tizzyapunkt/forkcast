import { useState } from 'react';
import { useRecipe } from '../../queries/use-recipe';
import { useUpdateRecipe } from '../../queries/use-update-recipe';
import { useDeleteRecipe } from '../../queries/use-delete-recipe';
import { RecipeForm } from './recipe-form';
import { ErrorBanner } from '../../components/app/error-banner';
import { de } from '../../i18n/de';

interface Props {
  id: string;
  onBack: () => void;
  onDeleted: () => void;
}

export function RecipeDetail({ id, onBack, onDeleted }: Props) {
  const { data: recipe, isLoading, error } = useRecipe(id);
  const updateMutation = useUpdateRecipe();
  const deleteMutation = useDeleteRecipe();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">{de.recipes.loading}</p>;
  if (error) return <ErrorBanner error={error} />;
  if (!recipe) return null;

  if (editing) {
    return (
      <RecipeForm
        initial={recipe}
        submitLabel={de.recipes.save}
        isSubmitting={updateMutation.isPending}
        error={updateMutation.error}
        onCancel={() => setEditing(false)}
        onSubmit={(values) =>
          updateMutation.mutate(
            { id, patch: values },
            {
              onSuccess: () => setEditing(false),
            },
          )
        }
      />
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          aria-label={de.recipes.backAria}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {de.recipes.back}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border px-3 py-1 text-sm"
            aria-label={de.recipes.editAria}
          >
            {de.recipes.edit}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-md border border-destructive px-3 py-1 text-sm text-destructive"
            aria-label={de.recipes.deleteAria}
          >
            {de.recipes.delete}
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">{recipe.name}</h2>
        <p className="text-xs text-muted-foreground">{de.recipes.yields(recipe.yield)}</p>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium">{de.recipes.ingredients}</h3>
        <ul className="divide-y">
          {recipe.ingredients.map((ing, idx) => (
            <li key={`${ing.name}|${idx}`} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium">{ing.name}</span>
              <span className="text-muted-foreground">
                {ing.amount} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">{de.recipes.steps}</h3>
        {recipe.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{de.recipes.noSteps}</p>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {recipe.steps.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ol>
        )}
      </section>

      {confirmDelete && (
        <div className="rounded-md border border-destructive bg-destructive/5 p-3">
          <p className="mb-2 text-sm">{de.recipes.deleteConfirm(recipe.name)}</p>
          {deleteMutation.error && <ErrorBanner error={deleteMutation.error} />}
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-md border px-3 py-2 text-sm">
              {de.recipeForm.cancel}
            </button>
            <button
              onClick={() =>
                deleteMutation.mutate(id, {
                  onSuccess: () => onDeleted(),
                })
              }
              disabled={deleteMutation.isPending}
              className="flex-1 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {deleteMutation.isPending ? de.recipes.deleting : de.recipes.deleteBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
