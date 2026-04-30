import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { RecipesScreen } from './recipes-screen';

describe('RecipesScreen', () => {
  it('shows the empty state when there are no recipes', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([])));
    renderWithProviders(<RecipesScreen />);
    expect(await screen.findByText(/noch keine rezepte/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /neues rezept/i })).toBeInTheDocument();
  });

  it('renders existing recipes alphabetically (server-sorted)', async () => {
    server.use(
      http.get('/api/recipes', () =>
        HttpResponse.json([
          {
            id: '1',
            name: 'Apple Pie',
            yield: 8,
            ingredients: [
              {
                name: 'apple',
                unit: 'g',
                macrosPerUnit: { calories: 0.5, protein: 0, carbs: 0.13, fat: 0 },
                amount: 500,
              },
            ],
            steps: [],
            createdAt: '',
            updatedAt: '',
          },
          {
            id: '2',
            name: 'Bolognese',
            yield: 4,
            ingredients: [
              {
                name: 'beef',
                unit: 'g',
                macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 },
                amount: 500,
              },
            ],
            steps: ['Cook'],
            createdAt: '',
            updatedAt: '',
          },
        ]),
      ),
    );

    renderWithProviders(<RecipesScreen />);
    expect(await screen.findByText('Apple Pie')).toBeInTheDocument();
    expect(screen.getByText('Bolognese')).toBeInTheDocument();
  });

  it('opens the create form when the "New recipe" button is tapped', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([])));
    renderWithProviders(<RecipesScreen />);
    await screen.findByText(/noch keine rezepte/i);
    await userEvent.click(screen.getByRole('button', { name: /neues rezept/i }));
    await waitFor(() => expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/ergibt/i)).toBeInTheDocument();
  });
});
