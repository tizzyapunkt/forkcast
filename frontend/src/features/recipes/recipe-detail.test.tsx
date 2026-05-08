import { screen } from '@testing-library/react';
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
