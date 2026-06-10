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
    // The servings stepper lives in the Pro-Portion hero at the top of the form.
    expect(screen.getByTestId('per-portion-hero')).toBeInTheDocument();
  });

  it('hides the "Aus Fotos" button when the import endpoint returns 503', async () => {
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([])),
      http.post('/api/import-recipe-from-photos', () =>
        HttpResponse.json({ error: 'ai-import-not-configured' }, { status: 503 }),
      ),
    );

    renderWithProviders(<RecipesScreen />);
    await screen.findByText(/noch keine rezepte/i);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /aus fotos/i })).not.toBeInTheDocument();
    });
  });

  it('shows the "Aus Fotos" button when the import endpoint is configured', async () => {
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([])),
      http.post('/api/import-recipe-from-photos', () =>
        HttpResponse.json({ error: 'At least one image is required' }, { status: 400 }),
      ),
    );

    renderWithProviders(<RecipesScreen />);
    await screen.findByText(/noch keine rezepte/i);
    expect(await screen.findByRole('button', { name: /aus fotos/i })).toBeInTheDocument();
  });

  it('renders a per-serving macro line on each recipe row', async () => {
    server.use(
      http.get('/api/recipes', () =>
        HttpResponse.json([
          {
            id: '1',
            name: 'Bolognese',
            yield: 2,
            ingredients: [
              {
                name: 'Hackfleisch',
                unit: 'g',
                macrosPerUnit: { calories: 2.5, protein: 0.2, carbs: 0, fat: 0.18 },
                amount: 400,
              },
            ],
            steps: [],
            createdAt: '',
            updatedAt: '',
          },
        ]),
      ),
    );
    renderWithProviders(<RecipesScreen />);
    await screen.findByText('Bolognese');
    // total 1000 kcal / yield 2 = 500 kcal per serving
    expect(screen.getByTestId('recipe-macro-line-1')).toHaveTextContent(/^500 kcal · 40 P \/ 0 C \/ 36 F$/);
    // existing meta line still rendered
    expect(screen.getByText(/1 Zutat · 2 Port\./)).toBeInTheDocument();
  });

  it('excludes untracked rows from the macro line rollup', async () => {
    server.use(
      http.get('/api/recipes', () =>
        HttpResponse.json([
          {
            id: '1',
            name: 'Salted Beef',
            yield: 1,
            ingredients: [
              {
                name: 'Beef',
                unit: 'g',
                macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 },
                amount: 200,
              },
              {
                name: 'Salz',
                unit: 'g',
                macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
                amount: 5,
                untracked: true,
              },
            ],
            steps: [],
            createdAt: '',
            updatedAt: '',
          },
        ]),
      ),
    );
    renderWithProviders(<RecipesScreen />);
    await screen.findByText('Salted Beef');
    // 200 × 2.5 = 500 kcal (salt's 5×9 = 45 kcal must be excluded)
    expect(screen.getByTestId('recipe-macro-line-1')).toHaveTextContent(/^500 kcal/);
  });
});
