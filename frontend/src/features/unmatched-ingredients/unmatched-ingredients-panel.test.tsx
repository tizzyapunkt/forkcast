import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { UnmatchedIngredientsPanel } from './unmatched-ingredients-panel';
import type { UnmatchedIngredientEntry } from '../../api/unmatched-ingredients';

const sample = (overrides: Partial<UnmatchedIngredientEntry> = {}): UnmatchedIngredientEntry => ({
  name: 'Buchweizenmehl',
  foldedName: 'buchweizenmehl',
  count: 3,
  firstSeenAt: '2026-05-16T10:00:00.000Z',
  lastSeenAt: '2026-05-16T12:00:00.000Z',
  samples: [{ rawName: 'Buchweizenmehl', rawUnit: 'g' }],
  ...overrides,
});

describe('UnmatchedIngredientsPanel', () => {
  it('disables Export and Clear when the store is empty', async () => {
    server.use(http.get('/api/unmatched-ingredients/export', () => HttpResponse.json({ entries: [] })));

    renderWithProviders(<UnmatchedIngredientsPanel />);

    const exportBtn = await screen.findByRole('button', { name: /exportieren/i });
    const clearBtn = await screen.findByRole('button', { name: /^leeren$/i });
    expect(exportBtn).toBeDisabled();
    expect(clearBtn).toBeDisabled();
    expect(screen.getByText(/noch nichts gesammelt/i)).toBeInTheDocument();
  });

  it('enables Export and Clear when entries exist and shows a confirm dialog before clearing', async () => {
    const user = userEvent.setup();
    let clearCalls = 0;
    server.use(
      http.get('/api/unmatched-ingredients/export', () =>
        HttpResponse.json({ entries: [sample(), sample({ name: 'Möhre', foldedName: 'mohre' })] }),
      ),
      http.post('/api/unmatched-ingredients/clear', () => {
        clearCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<UnmatchedIngredientsPanel />);

    const clearBtn = await screen.findByRole('button', { name: /^leeren$/i });
    await waitFor(() => expect(clearBtn).not.toBeDisabled());

    const exportBtn = screen.getByRole('button', { name: /exportieren/i });
    expect(exportBtn).not.toBeDisabled();

    await user.click(clearBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(clearCalls).toBe(0);

    const confirm = within(dialog).getByRole('button', { name: /^leeren$/i });
    await user.click(confirm);

    await waitFor(() => expect(clearCalls).toBe(1));
  });
});
