import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { BodyProfileForm } from './body-profile-form';

function profileFixture(overrides: Record<string, unknown> = {}) {
  return {
    weightKg: 80,
    heightCm: 180,
    ageYears: 30,
    sex: 'male',
    activityFactor: 1.55,
    goalPhase: 'recomposition',
    proteinPerKg: 2.0,
    fatPercent: 25,
    adjustmentPercent: 0,
    ...overrides,
  };
}

function computedFixture(overrides: Record<string, unknown> = {}) {
  return {
    ree: 1798.2,
    tdee: 2787.21,
    targetCalories: 2787,
    proteinGrams: 160,
    fatGrams: 77,
    carbsGrams: 354,
    proteinFatExceedsTarget: false,
    ...overrides,
  };
}

describe('BodyProfileForm', () => {
  it('renders default values and live preview when no profile is saved', async () => {
    server.use(http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })));
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    expect(await screen.findByRole('heading', { name: /makro-rechner/i })).toBeInTheDocument();
    // Default 80kg × 2.0 g/kg protein = 160 g shows in preview
    await waitFor(() => expect(screen.getByText('160 g')).toBeInTheDocument());
  });

  it('pre-fills fields from a saved profile', async () => {
    server.use(
      http.get('/api/body-profile', () =>
        HttpResponse.json({
          profile: profileFixture({ weightKg: 75, adjustmentPercent: -20 }),
          computed: computedFixture(),
        }),
      ),
    );
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    expect(await screen.findByDisplayValue('75')).toBeInTheDocument();
    expect(screen.getByDisplayValue('-20')).toBeInTheDocument();
  });

  it('selecting fat-loss phase pre-fills protein 2.2, fat 25%, adjustment -20', async () => {
    server.use(http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })));
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    await userEvent.selectOptions(screen.getByLabelText(/ziel-phase/i), 'fat-loss');
    await waitFor(() => expect(screen.getByLabelText(/eiweiß \(g\/kg\)/i)).toHaveValue(2.2));
    expect(screen.getByLabelText(/fett \(% tdee\)/i)).toHaveValue(25);
    expect(screen.getByLabelText(/kalorien-anpassung/i)).toHaveValue(-20);
  });

  it('manual override after phase select is preserved', async () => {
    server.use(http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })));
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    await userEvent.selectOptions(screen.getByLabelText(/ziel-phase/i), 'fat-loss');
    const proteinInput = screen.getByLabelText(/eiweiß \(g\/kg\)/i);
    await userEvent.clear(proteinInput);
    await userEvent.type(proteinInput, '2.5');
    expect(proteinInput).toHaveValue(2.5);
  });

  it('live preview reflects edits', async () => {
    server.use(http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })));
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    // initially 80 × 2.0 = 160 g protein
    await waitFor(() => expect(screen.getByText('160 g')).toBeInTheDocument());
    const weight = screen.getByLabelText(/gewicht/i);
    await userEvent.clear(weight);
    await userEvent.type(weight, '90');
    // 90 × 2.0 = 180 g protein
    await waitFor(() => expect(screen.getByText('180 g')).toBeInTheDocument());
  });

  it('shows the warning when protein+fat exceed target calories', async () => {
    server.use(http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })));
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    // set high protein g/kg, max fat % and aggressive deficit to trigger the warning
    const protein = screen.getByLabelText(/eiweiß \(g\/kg\)/i);
    await userEvent.clear(protein);
    await userEvent.type(protein, '4');
    const fat = screen.getByLabelText(/fett \(% tdee\)/i);
    await userEvent.clear(fat);
    await userEvent.type(fat, '60');
    const adj = screen.getByLabelText(/kalorien-anpassung/i);
    await userEvent.clear(adj);
    await userEvent.type(adj, '-40');
    await waitFor(() => expect(screen.getByText(/eiweiß \+ fett überschreiten bereits/i)).toBeInTheDocument());
  });

  it('save-as-goals calls PUT then POST /apply-as-goals and shows confirmation', async () => {
    let putCalled = false;
    let applyCalled = false;
    server.use(
      http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })),
      http.put('/api/body-profile', async ({ request }) => {
        putCalled = true;
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ profile: body, computed: computedFixture() });
      }),
      http.post('/api/body-profile/apply-as-goals', () => {
        applyCalled = true;
        return HttpResponse.json({ calories: 2787, protein: 160, carbs: 354, fat: 77 });
      }),
    );
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderWithProviders(<BodyProfileForm />, { queryClient });
    await screen.findByRole('heading', { name: /makro-rechner/i });

    await userEvent.click(screen.getByRole('button', { name: /als ziel übernehmen/i }));

    await waitFor(() => expect(applyCalled).toBe(true));
    expect(putCalled).toBe(true);
    expect(await screen.findByText(/als ziel übernommen/i)).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['nutrition-goal'] });
  });

  it('shows the divergence hint when saved profile computed kcal differs from active goal', async () => {
    server.use(
      http.get('/api/body-profile', () =>
        HttpResponse.json({ profile: profileFixture(), computed: computedFixture({ targetCalories: 2787 }) }),
      ),
      http.get('/api/nutrition-goal', () => HttpResponse.json({ calories: 2000, protein: 150, carbs: 200, fat: 70 })),
    );
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    expect(await screen.findByText(/aktives ziel weicht ab/i)).toBeInTheDocument();
  });
});
