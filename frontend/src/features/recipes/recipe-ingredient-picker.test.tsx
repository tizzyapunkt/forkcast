import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { RecipeIngredientPicker } from './recipe-ingredient-picker';
import type { RecipeIngredient } from '../../domain/recipes';

function PickerHarness({ onPicked }: { onPicked: (ing: RecipeIngredient) => void }) {
  const [open, setOpen] = useState(true);
  return <RecipeIngredientPicker open={open} onClose={() => setOpen(false)} onPicked={onPicked} />;
}

describe('RecipeIngredientPicker — overlay portal', () => {
  // The picker is rendered deep inside RecipeForm's subtree, but the scroll lock
  // freezes `#root` with `position: fixed`. On iOS a fixed ancestor becomes the
  // containing block for fixed descendants, so the drawer must portal OUT of the
  // app shell (into <body>) to stay anchored to the viewport. Guard that here.
  it('renders the dialog into <body>, not inside the host subtree', () => {
    const { container } = renderWithProviders(<PickerHarness onPicked={vi.fn<(ing: RecipeIngredient) => void>()} />);

    const dialog = screen.getByRole('dialog');
    expect(container).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
  });

  it('does not render anything into the host subtree when closed', () => {
    function ClosedHarness() {
      return (
        <RecipeIngredientPicker
          open={false}
          onClose={vi.fn<() => void>()}
          onPicked={vi.fn<(ing: RecipeIngredient) => void>()}
        />
      );
    }
    renderWithProviders(<ClosedHarness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('RecipeIngredientPicker — untracked propagation', () => {
  it('picking a FOODS-untracked result yields a row with untracked: true', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'salz',
            source: 'FOODS',
            name: 'Salz',
            unit: 'g',
            macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            untracked: true,
          },
        ]),
      ),
    );

    const onPicked = vi.fn<(ing: RecipeIngredient) => void>();
    const user = userEvent.setup();
    renderWithProviders(<PickerHarness onPicked={onPicked} />);

    await user.type(screen.getByRole('searchbox'), 'salz');
    const resultButton = await screen.findByRole('button', { name: /salz/i });
    await user.click(resultButton);

    const amountInput = await screen.findByLabelText(/menge pro rezept/i);
    await user.type(amountInput, '5');
    await user.click(screen.getByRole('button', { name: /^hinzufügen$/i }));

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1));
    expect(onPicked).toHaveBeenCalledWith({
      name: 'Salz',
      unit: 'g',
      macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      amount: 5,
      untracked: true,
    });
  });

  it('picking a tracked FOODS result yields a row without untracked', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'huehnchenbrust',
            source: 'FOODS',
            name: 'Hähnchenbrust',
            unit: 'g',
            macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.04 },
          },
        ]),
      ),
    );

    const onPicked = vi.fn<(ing: RecipeIngredient) => void>();
    const user = userEvent.setup();
    renderWithProviders(<PickerHarness onPicked={onPicked} />);

    await user.type(screen.getByRole('searchbox'), 'huh');
    const resultButton = await screen.findByRole('button', { name: /hähnchenbrust/i });
    await user.click(resultButton);

    const amountInput = await screen.findByLabelText(/menge pro rezept/i);
    await user.type(amountInput, '200');
    await user.click(screen.getByRole('button', { name: /^hinzufügen$/i }));

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1));
    const payload = onPicked.mock.calls[0]?.[0];
    expect(payload?.name).toBe('Hähnchenbrust');
    expect(payload?.amount).toBe(200);
    expect('untracked' in (payload ?? {})).toBe(false);
  });

  it('picking an OFF result yields a row without untracked even if the search response has the field', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: '0123456789012',
            source: 'OFF',
            name: 'Some product',
            unit: 'g',
            macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
          },
        ]),
      ),
    );

    const onPicked = vi.fn<(ing: RecipeIngredient) => void>();
    const user = userEvent.setup();
    renderWithProviders(<PickerHarness onPicked={onPicked} />);

    await user.type(screen.getByRole('searchbox'), 'product');
    const resultButton = await screen.findByRole('button', { name: /some product/i });
    await user.click(resultButton);

    const amountInput = await screen.findByLabelText(/menge pro rezept/i);
    await user.type(amountInput, '100');
    await user.click(screen.getByRole('button', { name: /^hinzufügen$/i }));

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1));
    const payload = onPicked.mock.calls[0]?.[0];
    expect('untracked' in (payload ?? {})).toBe(false);
  });
});
