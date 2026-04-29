import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import { renderWithProviders } from '../test/harness';
import { useRecipes } from './use-recipes';

function Consumer() {
  const { data, isLoading } = useRecipes();
  if (isLoading) return <p>loading</p>;
  return <p>count:{data?.length ?? 0}</p>;
}

describe('useRecipes', () => {
  it('fetches the recipes list', async () => {
    server.use(
      http.get('/api/recipes', () =>
        HttpResponse.json([
          {
            id: 'r1',
            name: 'A',
            yield: 1,
            ingredients: [
              { name: 'x', unit: 'g', macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 }, amount: 100 },
            ],
            steps: [],
            createdAt: '',
            updatedAt: '',
          },
        ]),
      ),
    );

    renderWithProviders(<Consumer />);
    expect(await screen.findByText('count:1')).toBeInTheDocument();
  });
});
