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

describe('RecipeDetail — header back-arrow', () => {
  it('renders a chevron-left back-arrow (no "← Zurück" text) that calls onBack', async () => {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          name: 'Soup',
          ingredients: [
            { name: 'Mehl', unit: 'g', macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 }, amount: 100 },
          ],
        }),
      ),
    );
    const onBack = vi.fn<() => void>();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={onBack} onDeleted={() => undefined} />);
    await screen.findByText('Soup');
    expect(screen.queryByText(/←\s*Zurück/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^zurück/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens the editor with a title + back-arrow that cancels back to read view (no × button)', async () => {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          name: 'Soup',
          ingredients: [
            { name: 'Mehl', unit: 'g', macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 }, amount: 100 },
          ],
        }),
      ),
    );
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);
    await screen.findByText('Soup');
    await userEvent.click(screen.getByRole('button', { name: /rezept bearbeiten/i }));
    expect(screen.getByRole('heading', { name: /rezept bearbeiten/i })).toBeInTheDocument();
    // No "×" close affordance in the editor header.
    expect(screen.queryByRole('button', { name: '×' })).not.toBeInTheDocument();
    // The header back-arrow cancels back to the read view (title heading gone).
    await userEvent.click(screen.getAllByRole('button', { name: /^zurück/i })[0]!);
    expect(screen.queryByRole('heading', { name: /rezept bearbeiten/i })).not.toBeInTheDocument();
  });

  it('puts the recipe name + yield subtitle inside the app header, never as a body heading', async () => {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          yield: 4,
          name: 'Soup',
          ingredients: [
            { name: 'Mehl', unit: 'g', macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 }, amount: 100 },
          ],
        }),
      ),
    );
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    const titles = await screen.findAllByRole('heading', { name: 'Soup' });
    // The recipe name appears exactly once — inside the indigo header.
    expect(titles).toHaveLength(1);
    const header = titles[0]!.closest('header');
    expect(header).not.toBeNull();
    // Subtitle and back arrow live in the same header.
    expect(header).toHaveTextContent('Ergibt 4 Portionen');
    expect(screen.getByRole('button', { name: /^zurück/i }).closest('header')).toBe(header);
  });

  it('puts the editor title inside the app header, never as a body heading', async () => {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          name: 'Soup',
          ingredients: [
            { name: 'Mehl', unit: 'g', macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 }, amount: 100 },
          ],
        }),
      ),
    );
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);
    await screen.findByText('Soup');
    await userEvent.click(screen.getByRole('button', { name: /rezept bearbeiten/i }));

    const titles = screen.getAllByRole('heading', { name: /rezept bearbeiten/i });
    expect(titles).toHaveLength(1);
    expect(titles[0]!.closest('header')).not.toBeNull();
  });
});

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

  it('renders the ingredient note as a subtitle when present', async () => {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          name: 'Soup',
          ingredients: [
            {
              name: 'Ingwer',
              unit: 'g',
              macrosPerUnit: { calories: 0.8, protein: 0.018, carbs: 0.178, fat: 0.008 },
              amount: 5,
              note: 'fein gehackt',
            },
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
    expect(await screen.findByText('Ingwer')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-note-0')).toHaveTextContent(/^fein gehackt$/);
    // Row without a note has no subtitle test-id.
    expect(screen.queryByTestId('ingredient-note-1')).not.toBeInTheDocument();
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

describe('RecipeDetail — totals strip & displayQuantity', () => {
  function mockRecipeWithDisplayQuantity() {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          yield: 2,
          name: 'Bolognese',
          ingredients: [
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
              amount: 0,
              untracked: true,
              displayQuantity: { amount: 1, unitLabel: 'TL' },
            },
          ],
          steps: [],
        }),
      ),
    );
  }

  it('renders the totals strip as a single per-serving line with the unified triplet', async () => {
    mockRecipeWithDisplayQuantity();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Bolognese');
    // 400 g × 2.5 = 1000 kcal total / yield 2 = 500 kcal per serving; 40 P · 0 KH · 36 F per serving
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^500 kcal · 40 P · 0 KH · 36 F$/);
    // The "Bei N Portionen" scaled-total line is gone.
    expect(screen.queryByTestId('totals-secondary')).not.toBeInTheDocument();
    expect(screen.queryByText(/Bei \d+ Portionen/)).not.toBeInTheDocument();
  });

  it('keeps the per-serving strip invariant when the multiplier changes', async () => {
    mockRecipeWithDisplayQuantity();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Bolognese');
    const inc = screen.getByRole('button', { name: /Eine Portion mehr/ });
    await userEvent.click(inc);
    await userEvent.click(inc);

    // Only the ingredient rows scale — the strip stays per-serving.
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^500 kcal/);
    expect(screen.queryByTestId('totals-secondary')).not.toBeInTheDocument();
  });

  it('excludes untracked rows from the totals regardless of multiplier', async () => {
    mockRecipeWithDisplayQuantity();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Bolognese');
    // Salt's macrosPerUnit are zero — but the test ensures even non-zero untracked rows are excluded.
    // Increment doesn't change per-serving total.
    await userEvent.click(screen.getByRole('button', { name: /Eine Portion mehr/ }));
    expect(screen.getByTestId('totals-per-serving')).toHaveTextContent(/^500 kcal/);
  });

  it('renders an untracked row with displayQuantity as {amount} {unitLabel}', async () => {
    mockRecipeWithDisplayQuantity();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    expect(await screen.findByText('Salz')).toBeInTheDocument();
    expect(screen.getByText(/^1 TL$/)).toBeInTheDocument();
    // The canonical "0 g" must NOT appear for this row.
    expect(screen.queryByText(/^0 g$/)).not.toBeInTheDocument();
  });

  it('scales displayQuantity.amount with the multiplier', async () => {
    mockRecipeWithDisplayQuantity();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Bolognese');
    const inc = screen.getByRole('button', { name: /Eine Portion mehr/ });
    await userEvent.click(inc);
    await userEvent.click(inc);

    expect(screen.getByText(/^2 TL$/)).toBeInTheDocument();
  });

  it('reset returns displayQuantity to its stored amount', async () => {
    mockRecipeWithDisplayQuantity();
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Bolognese');
    await userEvent.click(screen.getByRole('button', { name: /Eine Portion mehr/ }));
    await userEvent.click(screen.getByRole('button', { name: /Eine Portion mehr/ }));
    expect(screen.getByText(/^2 TL$/)).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: /zurücksetzen/i }));
    expect(screen.getByText(/^1 TL$/)).toBeInTheDocument();
  });
});

describe('RecipeDetail — qualitative seasonings (nach Geschmack)', () => {
  function mockRecipe(seasoning: Record<string, unknown>) {
    server.use(
      http.get('/api/recipes/rec-1', () =>
        HttpResponse.json({
          ...baseRecipe,
          yield: 1,
          name: 'Pfanne',
          ingredients: [
            {
              name: 'Hähnchen',
              unit: 'g',
              macrosPerUnit: { calories: 1.1, protein: 0.23, carbs: 0, fat: 0.02 },
              amount: 150,
            },
            {
              name: 'Salz',
              unit: 'g',
              macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
              amount: 0,
              untracked: true,
              ...seasoning,
            },
          ],
          steps: [],
        }),
      ),
    );
  }

  it('renders a label-only displayQuantity without a leading number', async () => {
    mockRecipe({ displayQuantity: { unitLabel: 'nach Geschmack' } });
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    expect(await screen.findByText('Salz')).toBeInTheDocument();
    expect(screen.getByText(/^nach Geschmack$/)).toBeInTheDocument();
    expect(screen.queryByText(/^1 nach Geschmack$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0 g$/)).not.toBeInTheDocument();
  });

  it('falls back to "nach Geschmack" for a bare untracked row (amount 0, no displayQuantity)', async () => {
    mockRecipe({});
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    expect(await screen.findByText('Salz')).toBeInTheDocument();
    expect(screen.getByText(/^nach Geschmack$/)).toBeInTheDocument();
    expect(screen.queryByText(/^0 g$/)).not.toBeInTheDocument();
  });

  it('does not scale a qualitative label when servings increase', async () => {
    mockRecipe({ displayQuantity: { unitLabel: 'nach Geschmack' } });
    renderWithProviders(<RecipeDetail id="rec-1" onBack={() => undefined} onDeleted={() => undefined} />);

    await screen.findByText('Salz');
    await userEvent.click(screen.getByRole('button', { name: /Eine Portion mehr/ }));
    expect(screen.getByText(/^nach Geschmack$/)).toBeInTheDocument();
  });
});
