import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { RecipeDetail } from './recipe-detail';

const baseRecipe = {
  id: 'rec-1',
  yield: 1,
  steps: [],
  createdAt: '',
  updatedAt: '',
};

describe('RecipeDetail — dual-form rendering', () => {
  it('renders piece-tracked rows with both count and weight', async () => {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          name: 'Soup',
          ingredients: [
            {
              name: 'Zwiebel',
              unit: 'g',
              macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
              amount: 150,
              pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
            },
          ],
        }),
      ),
    );

    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    expect(await screen.findByText('Zwiebel')).toBeInTheDocument();
    expect(screen.getByText(/1 Zwiebel \(≈ 150 g\)/)).toBeInTheDocument();
  });

  it('renders mass-only rows with the legacy "amount unit" format', async () => {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          name: 'Cake',
          ingredients: [
            {
              name: 'Mehl',
              unit: 'g',
              macrosPerUnit: { calories: 3.4, protein: 0.1, carbs: 0.7, fat: 0.01 },
              amount: 200,
            },
          ],
        }),
      ),
    );

    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);
    expect(await screen.findByText('Mehl')).toBeInTheDocument();
    expect(screen.getByText('200 g')).toBeInTheDocument();
  });
});

describe('RecipeDetail — untracked rendering', () => {
  it('renders untracked rows inline with a badge in their original position', async () => {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          name: 'Chicken with salt',
          ingredients: [
            {
              name: 'Hähnchenbrust',
              unit: 'g',
              macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.04 },
              amount: 200,
            },
            {
              name: 'Salz',
              unit: 'g',
              macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
              amount: 5,
              untracked: true,
            },
            {
              name: 'Pfeffer',
              unit: 'g',
              macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
              amount: 2,
              untracked: true,
            },
          ],
        }),
      ),
    );

    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    // All three rows render in order; only the second and third are badged untracked.
    expect(await screen.findByText('Hähnchenbrust')).toBeInTheDocument();
    expect(screen.getByText('Salz')).toBeInTheDocument();
    expect(screen.getByText('Pfeffer')).toBeInTheDocument();
    expect(screen.queryByTestId('untracked-badge-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('untracked-badge-1')).toBeInTheDocument();
    expect(screen.getByTestId('untracked-badge-2')).toBeInTheDocument();
  });
});

describe('RecipeDetail — servings multiplier', () => {
  function mockRecipe() {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          yield: 2,
          name: 'Bolognese',
          ingredients: [
            {
              name: 'Zwiebel',
              unit: 'g',
              macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
              amount: 150,
              pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
            },
            {
              name: 'Hackfleisch',
              unit: 'g',
              macrosPerUnit: { calories: 2.5, protein: 0.2, carbs: 0, fat: 0.18 },
              amount: 400,
            },
            {
              name: 'Salz',
              unit: 'g',
              macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
              amount: 5,
              untracked: true,
            },
          ],
          steps: ['Add 1 chopped onion.', 'Brown the meat.'],
        }),
      ),
    );
  }

  it('defaults the multiplier to the stored yield and renders unscaled amounts', async () => {
    mockRecipe();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    expect(await screen.findByText('Bolognese')).toBeInTheDocument();
    const servings = screen.getByLabelText('Portionen');
    expect(servings).toHaveValue(2);
    expect(screen.getByText(/1 Zwiebel \(≈ 150 g\)/)).toBeInTheDocument();
    expect(screen.getByText('400 g')).toBeInTheDocument();
    expect(screen.getByText('5 g')).toBeInTheDocument();
  });

  it('rescales mass-only, piece-quantity, and untracked rows when incremented', async () => {
    mockRecipe();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Bolognese');
    const inc = screen.getByRole('button', { name: /Eine Portion mehr/ });
    await userEvent.click(inc);
    await userEvent.click(inc);

    // factor = 4 / 2 = 2
    expect(screen.getByText(/2 Zwiebel \(≈ 300 g\)/)).toBeInTheDocument();
    expect(screen.getByText('800 g')).toBeInTheDocument();
    expect(screen.getByText('10 g')).toBeInTheDocument();
    // Untracked badge still rendered on the third row.
    expect(screen.getByTestId('untracked-badge-2')).toBeInTheDocument();
  });

  it('floors the decrement at 1', async () => {
    mockRecipe();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Bolognese');
    const dec = screen.getByRole('button', { name: /Eine Portion weniger/ });
    await userEvent.click(dec); // 2 -> 1
    await userEvent.click(dec); // stays at 1
    await userEvent.click(dec); // stays at 1

    expect(screen.getByLabelText('Portionen')).toHaveValue(1);
    // factor = 0.5
    expect(screen.getByText(/0\.5 Zwiebel \(≈ 75 g\)/)).toBeInTheDocument();
    expect(screen.getByText('200 g')).toBeInTheDocument();
  });

  it('shows reset only when the value differs from the stored yield, and reset returns to it', async () => {
    mockRecipe();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Bolognese');
    // At default (stored yield), reset is not shown.
    expect(screen.queryByRole('button', { name: /zurücksetzen/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Eine Portion mehr/ }));
    const reset = await screen.findByRole('button', { name: /zurücksetzen/i });
    await userEvent.click(reset);

    expect(screen.getByLabelText('Portionen')).toHaveValue(2);
    expect(screen.getByText(/1 Zwiebel \(≈ 150 g\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /zurücksetzen/i })).not.toBeInTheDocument();
  });

  it('does not rescale the steps text when the multiplier changes', async () => {
    mockRecipe();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Bolognese');
    await userEvent.click(screen.getByRole('button', { name: /Eine Portion mehr/ }));
    await userEvent.click(screen.getByRole('button', { name: /Eine Portion mehr/ }));

    expect(screen.getByText('Add 1 chopped onion.')).toBeInTheDocument();
    expect(screen.getByText('Brown the meat.')).toBeInTheDocument();
  });
});
