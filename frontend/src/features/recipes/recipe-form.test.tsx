import { fireEvent, render, screen, within } from '@testing-library/react';
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
  it('places the Pro-Portion hero at the top of the form with a co-located servings stepper', () => {
    setup({ id: '', name: 'X', yield: 2, ingredients: [flour], steps: [], createdAt: '', updatedAt: '' });
    const hero = screen.getByTestId('per-portion-hero');
    expect(within(hero).getByLabelText('Portionen')).toHaveValue(2);
    expect(within(hero).getByRole('button', { name: /eine portion mehr/i })).toBeInTheDocument();
    // The hero precedes the ingredient editor's "Zutaten" heading in the document.
    const rel = hero.compareDocumentPosition(screen.getByRole('heading', { name: 'Zutaten' }));
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the Pro-Portion hero with zeros when there are no ingredients', () => {
    setup(undefined, []);
    expect(screen.getByTestId('per-portion-hero')).toBeInTheDocument();
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
    await user.click(screen.getByRole('radio', { name: 'Frei' }));
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^0 kcal · 0 P \/ 0 C \/ 0 F$/);
  });

  it('updates the strip when the amount is edited', () => {
    setup({ id: '', name: 'X', yield: 1, ingredients: [flour], steps: [], createdAt: '', updatedAt: '' });
    const amount = screen.getByLabelText('Menge für Mehl');
    fireEvent.change(amount, { target: { value: '100' } });
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^340 kcal · 10 P \/ 70 C \/ 1 F$/);
  });

  it('updates the hero when the servings stepper changes (per-serving divides; total invariant)', async () => {
    const user = userEvent.setup();
    setup({ id: '', name: 'X', yield: 1, ingredients: [flour], steps: [], createdAt: '', updatedAt: '' });
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^680 kcal/);
    expect(screen.getByTestId('totals-secondary')).toHaveTextContent(/680 kcal/);
    await user.click(screen.getByRole('button', { name: /eine portion mehr/i }));
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^340 kcal/);
    // Total is invariant under the servings change.
    expect(screen.getByTestId('totals-secondary')).toHaveTextContent(/680 kcal/);
  });

  it('excludes untracked rows from the rollup', () => {
    setup({ id: '', name: 'X', yield: 1, ingredients: [flour, salt], steps: [], createdAt: '', updatedAt: '' });
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^680 kcal · 20 P \/ 140 C \/ 2 F$/);
  });
});

describe('RecipeForm — ingredient note on submit', () => {
  it('submits note only on rows that have a non-empty note; omits the field elsewhere', async () => {
    const user = userEvent.setup();
    const flourWithNote: RecipeIngredient = { ...flour, note: 'gesiebt' };
    const recipe: Recipe = {
      id: '',
      name: 'Dough',
      yield: 1,
      ingredients: [flourWithNote, flour],
      steps: [],
      createdAt: '',
      updatedAt: '',
    };
    const { onSubmit } = setup(recipe);
    await user.click(screen.getByRole('button', { name: /speichern/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]![0];
    expect(payload.ingredients[0]?.note).toBe('gesiebt');
    expect(payload.ingredients[1]).not.toHaveProperty('note');
  });

  it('trims surrounding whitespace from note on submit', async () => {
    const user = userEvent.setup();
    const flourWithPadding: RecipeIngredient = { ...flour, note: '  gesiebt  ' };
    const recipe: Recipe = {
      id: '',
      name: 'Dough',
      yield: 1,
      ingredients: [flourWithPadding],
      steps: [],
      createdAt: '',
      updatedAt: '',
    };
    const { onSubmit } = setup(recipe);
    await user.click(screen.getByRole('button', { name: /speichern/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0].ingredients[0]?.note).toBe('gesiebt');
  });

  it('drops a whitespace-only note from the payload', async () => {
    const user = userEvent.setup();
    const flourWithBlank: RecipeIngredient = { ...flour, note: '   ' };
    const recipe: Recipe = {
      id: '',
      name: 'Dough',
      yield: 1,
      ingredients: [flourWithBlank],
      steps: [],
      createdAt: '',
      updatedAt: '',
    };
    const { onSubmit } = setup(recipe);
    await user.click(screen.getByRole('button', { name: /speichern/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0].ingredients[0]).not.toHaveProperty('note');
  });
});
