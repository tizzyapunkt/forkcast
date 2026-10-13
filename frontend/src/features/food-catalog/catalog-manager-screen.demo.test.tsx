import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { CatalogManagerScreen } from './catalog-manager-screen';

vi.mock('../../demo/is-demo', () => ({ isDemo: true }));

describe('Catalog editor in the demo', () => {
  it('has no AI fill button, but the fields stay editable', async () => {
    server.use(
      http.get('/api/catalog', () =>
        HttpResponse.json({
          entries: [
            {
              id: 'moehre',
              name: 'Möhre',
              synonyms: [],
              unit: 'g',
              macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
            },
          ],
        }),
      ),
    );
    renderWithProviders(<CatalogManagerScreen onBack={() => {}} />);

    await userEvent.click(await screen.findByRole('button', { name: /möhre bearbeiten/i }));

    expect(await screen.findByLabelText('Englischer Name')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KI ausfüllen' })).not.toBeInTheDocument();
  });
});
