import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeForm } from './recipe-form';
import type { Recipe, RecipeIngredient } from '../../domain/recipes';

function setup(initial?: Recipe, ingredientsOverride?: RecipeIngredient[]) {
  const onSubmit =
    vi.fn<(values: { name: string; yield: number; ingredients: RecipeIngredient[]; steps: string[] }) => void>();
  const onCancel = vi.fn<() => void>();
  let captured: RecipeIngredient[] | undefined = ingredientsOverride ?? initial?.ingredients;

  // Controlled ingredient state via a small wrapper so tests can drive ingredient changes.
  function Wrapper() {
    return (
      <RecipeForm
        initial={initial}
        submitLabel="Speichern"
        isSubmitting={false}
        onCancel={onCancel}
        onSubmit={onSubmit}
        ingredients={captured ?? []}
        onIngredientsChange={(next) => {
          captured = next;
          // re-render
          rerender(<Wrapper />);
        }}
      />
    );
  }

  const { rerender } = render(<Wrapper />);
  return {
    onSubmit,
    setIngredients: (next: RecipeIngredient[]) => {
      captured = next;
      rerender(<Wrapper />);
    },
  };
}

const flour: RecipeIngredient = {
  name: 'Mehl',
  unit: 'g',
  macrosPerUnit: { calories: 3.4, protein: 0.1, carbs: 0.7, fat: 0.01 },
  amount: 200,
};

const salt: RecipeIngredient = {
  name: 'Salz',
  unit: 'g',
  macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  amount: 5,
  untracked: true,
};

describe('RecipeForm — live totals strip', () => {
  it('renders the totals strip with zeros when there are no ingredients', () => {
    setup(undefined, []);
    const strip = screen.getByTestId('recipe-totals-strip');
    expect(strip).toBeInTheDocument();
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^0 kcal · 0 P \/ 0 C \/ 0 F$/);
  });

  it('updates the per-serving line when a tracked ingredient is present', () => {
    setup({ id: '', name: 'X', yield: 1, ingredients: [flour], steps: [], createdAt: '', updatedAt: '' });
    // 200 g × 3.4 kcal/g = 680 kcal, 200 × 0.1 = 20 P, 200 × 0.7 = 140 C, 200 × 0.01 = 2 F
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^680 kcal · 20 P \/ 140 C \/ 2 F$/);
  });

  it('updates the strip when an ingredient is toggled untracked', async () => {
    const user = userEvent.setup();
    setup({ id: '', name: 'X', yield: 1, ingredients: [flour], steps: [], createdAt: '', updatedAt: '' });
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^680 kcal/);
    await user.click(screen.getByTestId('untracked-toggle-0'));
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^0 kcal · 0 P \/ 0 C \/ 0 F$/);
  });

  it('updates the strip when the amount is edited', () => {
    setup({ id: '', name: 'X', yield: 1, ingredients: [flour], steps: [], createdAt: '', updatedAt: '' });
    const amount = screen.getByLabelText('Menge für Mehl');
    fireEvent.change(amount, { target: { value: '100' } });
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^340 kcal · 10 P \/ 70 C \/ 1 F$/);
  });

  it('updates the strip when the yield changes (per-serving divides; total invariant)', () => {
    setup({ id: '', name: 'X', yield: 1, ingredients: [flour], steps: [], createdAt: '', updatedAt: '' });
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^680 kcal/);
    expect(screen.getByTestId('totals-secondary')).toHaveTextContent(/^680 kcal/);
    const yieldInput = screen.getByLabelText(/ergibt/i);
    fireEvent.change(yieldInput, { target: { value: '2' } });
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^340 kcal/);
    expect(screen.getByTestId('totals-secondary')).toHaveTextContent(/^680 kcal/);
  });

  it('excludes untracked rows from the rollup', () => {
    setup({ id: '', name: 'X', yield: 1, ingredients: [flour, salt], steps: [], createdAt: '', updatedAt: '' });
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^680 kcal · 20 P \/ 140 C \/ 2 F$/);
  });
});
