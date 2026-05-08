import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { ReviewImportScreen } from './review-import-screen';
import type { RecipeDraft } from '../../domain/recipes';

const draft: RecipeDraft = {
  name: 'Test Pasta',
  yield: 2,
  steps: ['Boil water', 'Cook pasta'],
  ingredients: [
    {
      matched: true,
      name: 'Olivenöl',
      unit: 'ml',
      macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
      amount: 30,
      unitOverridden: false,
      source: 'BLS',
    },
    {
      matched: true,
      name: 'Tomatenmark',
      unit: 'g',
      macrosPerUnit: { calories: 0.8, protein: 0.04, carbs: 0.13, fat: 0 },
      amount: 50,
      unitOverridden: true,
      source: 'BLS',
    },
    {
      matched: false,
      name: 'mystery herb',
      amount: 1,
      unit: 'tsp',
    },
  ],
};

describe('ReviewImportScreen', () => {
  it('renders matched ingredients in the form and lists unmatched in the banner', async () => {
    renderWithProviders(<ReviewImportScreen draft={draft} onSaved={() => {}} onCancel={() => {}} />);

    expect(screen.getByDisplayValue('Test Pasta')).toBeInTheDocument();
    expect(screen.getByText('Olivenöl')).toBeInTheDocument();
    expect(screen.getByText('Tomatenmark')).toBeInTheDocument();
    expect(screen.getByText(/1 zutat ohne treffer/i)).toBeInTheDocument();
    expect(screen.getByText('mystery herb')).toBeInTheDocument();
  });

  it('shows an unitOverridden indicator when the catalog unit replaced the model unit', () => {
    renderWithProviders(<ReviewImportScreen draft={draft} onSaved={() => {}} onCancel={() => {}} />);

    expect(screen.getByTestId('unit-override-1')).toBeInTheDocument();
  });

  it('discards an unmatched ingredient without resolving it', async () => {
    renderWithProviders(<ReviewImportScreen draft={draft} onSaved={() => {}} onCancel={() => {}} />);

    await userEvent.click(screen.getByLabelText(/mystery herb.*verwerfen/i));
    expect(screen.queryByText('mystery herb')).not.toBeInTheDocument();
    expect(screen.queryByText(/zutat ohne treffer/i)).not.toBeInTheDocument();
  });

  it('submits via POST /add-recipe and calls onSaved', async () => {
    server.use(
      http.post('/api/add-recipe', async ({ request }) => {
        const body = (await request.json()) as { name: string; ingredients: unknown[]; steps: unknown[] };
        expect(body.name).toBe('Test Pasta');
        expect(body.ingredients).toHaveLength(2);
        return HttpResponse.json({ id: 'new-1', ...body, createdAt: '', updatedAt: '' }, { status: 201 });
      }),
    );

    const onSaved = vi.fn<() => void>();
    renderWithProviders(<ReviewImportScreen draft={draft} onSaved={onSaved} onCancel={() => {}} />);

    await userEvent.click(screen.getByLabelText(/mystery herb.*verwerfen/i));
    await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
