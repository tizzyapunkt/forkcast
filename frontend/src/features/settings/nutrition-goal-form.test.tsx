import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { makeGoal } from '../../test/msw/fixtures';
import { NutritionGoalForm } from './nutrition-goal-form';

describe('NutritionGoalForm', () => {
  it('pre-fills fields from the current goal', async () => {
    server.use(http.get('/api/nutrition-goal', () => HttpResponse.json(makeGoal({ calories: 2500, protein: 180 }))));
    renderWithProviders(<NutritionGoalForm />, { queryClient: createTestQueryClient() });
    expect(await screen.findByDisplayValue('2500')).toBeInTheDocument();
    expect(screen.getByDisplayValue('180')).toBeInTheDocument();
  });

  it('renders empty fields when goal returns 404', async () => {
    server.use(
      http.get('/api/nutrition-goal', () => HttpResponse.json({ error: 'No nutrition goal set' }, { status: 404 })),
    );
    renderWithProviders(<NutritionGoalForm />, { queryClient: createTestQueryClient() });
    // wait for load to complete — all fields should be blank / zero
    await screen.findByRole('button', { name: /ziel speichern/i });
    const calInput = screen.getByLabelText(/kalorien/i) as HTMLInputElement;
    expect(calInput.value).toBe('');
  });

  it('blocks submission when calories is missing', async () => {
    renderWithProviders(<NutritionGoalForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('button', { name: /ziel speichern/i });
    await userEvent.click(screen.getByRole('button', { name: /ziel speichern/i }));
    expect(await screen.findByText(/kalorien müssen/i)).toBeInTheDocument();
  });

  it('PUTs the goal and shows a saved confirmation', async () => {
    const goal = makeGoal({ calories: 1800, protein: 140, carbs: 180, fat: 60 });
    server.use(
      http.get('/api/nutrition-goal', () => HttpResponse.json(makeGoal())),
      http.put('/api/nutrition-goal', () => HttpResponse.json(goal)),
    );
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithProviders(<NutritionGoalForm />, { queryClient });
    await screen.findByDisplayValue('2000');

    const cal = screen.getByLabelText(/kalorien/i);
    await userEvent.clear(cal);
    await userEvent.type(cal, '1800');
    await userEvent.click(screen.getByRole('button', { name: /ziel speichern/i }));

    expect(await screen.findByText(/gespeichert/i)).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['nutrition-goal'] });
  });

  it('validates that macros are non-negative', async () => {
    server.use(http.get('/api/nutrition-goal', () => HttpResponse.json(makeGoal())));
    renderWithProviders(<NutritionGoalForm />, { queryClient: createTestQueryClient() });
    await screen.findByDisplayValue('2000');

    const protein = screen.getByLabelText(/eiweiß/i);
    await userEvent.clear(protein);
    await userEvent.type(protein, '-10');
    await userEvent.click(screen.getByRole('button', { name: /ziel speichern/i }));

    expect(await screen.findByText(/≥ 0/i)).toBeInTheDocument();
  });
});
