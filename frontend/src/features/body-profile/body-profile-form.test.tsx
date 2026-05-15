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

  it('pre-fills fields from a saved profile and renders deficit direction + positive magnitude', async () => {
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
    expect(screen.getByRole('radio', { name: /defizit/i })).toBeChecked();
    expect(screen.getByLabelText(/anpassung \(%\)/i)).toHaveValue(20);
  });

  it('selecting fat-loss phase pre-fills protein 2.2, fat 25%, deficit direction + magnitude 20', async () => {
    server.use(http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })));
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    await userEvent.selectOptions(screen.getByLabelText(/ziel-phase/i), 'fat-loss');
    await waitFor(() => expect(screen.getByLabelText(/eiweiß \(g\/kg\)/i)).toHaveValue(2.2));
    expect(screen.getByLabelText(/fett \(% tdee\)/i)).toHaveValue(25);
    expect(screen.getByRole('radio', { name: /defizit/i })).toBeChecked();
    expect(screen.getByLabelText(/anpassung \(%\)/i)).toHaveValue(20);
  });

  it('selecting Defizit + magnitude 20 saves adjustmentPercent: -20', async () => {
    let savedBody: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })),
      http.put('/api/body-profile', async ({ request }) => {
        savedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ profile: savedBody, computed: computedFixture() });
      }),
    );
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    await userEvent.click(screen.getByRole('radio', { name: /defizit/i }));
    const magnitude = screen.getByLabelText(/anpassung \(%\)/i);
    await userEvent.clear(magnitude);
    await userEvent.type(magnitude, '20');
    await userEvent.click(screen.getByRole('button', { name: /profil speichern/i }));
    await waitFor(() => expect(savedBody?.adjustmentPercent).toBe(-20));
  });

  it('selecting Überschuss + magnitude 10 saves adjustmentPercent: 10', async () => {
    let savedBody: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })),
      http.put('/api/body-profile', async ({ request }) => {
        savedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ profile: savedBody, computed: computedFixture() });
      }),
    );
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    await userEvent.click(screen.getByRole('radio', { name: /überschuss/i }));
    const magnitude = screen.getByLabelText(/anpassung \(%\)/i);
    await userEvent.clear(magnitude);
    await userEvent.type(magnitude, '10');
    await userEvent.click(screen.getByRole('button', { name: /profil speichern/i }));
    await waitFor(() => expect(savedBody?.adjustmentPercent).toBe(10));
  });

  it('switching from Erhalt to Defizit clears the magnitude input so the user can type immediately', async () => {
    server.use(http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })));
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    expect(screen.getByLabelText(/anpassung \(%\)/i)).toHaveValue(0);
    await userEvent.click(screen.getByRole('radio', { name: /defizit/i }));
    expect(screen.getByLabelText(/anpassung \(%\)/i)).toHaveValue(null);
    await userEvent.click(screen.getByRole('radio', { name: /erhalt/i }));
    expect(screen.getByLabelText(/anpassung \(%\)/i)).toHaveValue(0);
  });

  it('switching from Defizit with a non-zero magnitude to Überschuss preserves the magnitude', async () => {
    server.use(http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })));
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    await userEvent.click(screen.getByRole('radio', { name: /defizit/i }));
    const magnitude = screen.getByLabelText(/anpassung \(%\)/i);
    await userEvent.clear(magnitude);
    await userEvent.type(magnitude, '15');
    await userEvent.click(screen.getByRole('radio', { name: /überschuss/i }));
    expect(magnitude).toHaveValue(15);
  });

  it('selecting Erhalt disables the magnitude input and saves adjustmentPercent: 0', async () => {
    let savedBody: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/body-profile', () =>
        HttpResponse.json({
          profile: profileFixture({ adjustmentPercent: -20 }),
          computed: computedFixture(),
        }),
      ),
      http.put('/api/body-profile', async ({ request }) => {
        savedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ profile: savedBody, computed: computedFixture() });
      }),
    );
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    expect(await screen.findByLabelText(/anpassung \(%\)/i)).toHaveValue(20);
    await userEvent.click(screen.getByRole('radio', { name: /erhalt/i }));
    expect(screen.getByLabelText(/anpassung \(%\)/i)).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /profil speichern/i }));
    await waitFor(() => expect(savedBody?.adjustmentPercent).toBe(0));
  });

  it('out-of-range magnitude surfaces the existing adjustmentRange error and blocks save', async () => {
    let putCalled = false;
    server.use(
      http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })),
      http.put('/api/body-profile', () => {
        putCalled = true;
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    await userEvent.click(screen.getByRole('radio', { name: /defizit/i }));
    const magnitude = screen.getByLabelText(/anpassung \(%\)/i);
    await userEvent.clear(magnitude);
    await userEvent.type(magnitude, '50');
    await userEvent.click(screen.getByRole('button', { name: /profil speichern/i }));
    expect(await screen.findByText(/zwischen −40 und \+40/i)).toBeInTheDocument();
    expect(putCalled).toBe(false);
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
    await userEvent.click(screen.getByRole('radio', { name: /defizit/i }));
    const magnitude = screen.getByLabelText(/anpassung \(%\)/i);
    await userEvent.clear(magnitude);
    await userEvent.type(magnitude, '40');
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

  it('renders the trailing-7d-avg hint and applies the value when clicked', async () => {
    server.use(
      http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })),
      http.get('/api/weight-log/trend', () =>
        HttpResponse.json({
          current: 78.4,
          movingAverage7d: 78.2,
          weeklyRatePercent: -0.5,
          changePercent28d: null,
          totalChangePercent: null,
          firstEntryDate: '2026-05-08',
          lastEntryDate: '2026-05-15',
          totalEntries: 7,
        }),
      ),
    );
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    expect(screen.getByText(/7-Tage-Trend: 78\.2 kg/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /trend-gewicht in formular übernehmen/i }));
    expect(screen.getByLabelText(/gewicht \(kg\)/i)).toHaveValue(78.2);
  });

  it('hides the trailing-7d-avg hint when MA is null', async () => {
    server.use(
      http.get('/api/body-profile', () => new HttpResponse(null, { status: 404 })),
      http.get('/api/weight-log/trend', () =>
        HttpResponse.json({
          current: null,
          movingAverage7d: null,
          weeklyRatePercent: null,
          changePercent28d: null,
          totalChangePercent: null,
          firstEntryDate: null,
          lastEntryDate: null,
          totalEntries: 0,
        }),
      ),
    );
    renderWithProviders(<BodyProfileForm />, { queryClient: createTestQueryClient() });
    await screen.findByRole('heading', { name: /makro-rechner/i });
    expect(screen.queryByText(/7-Tage-Trend/)).not.toBeInTheDocument();
  });
});
