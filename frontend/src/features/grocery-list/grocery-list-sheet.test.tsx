import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { GroceryListSheet } from './grocery-list-sheet';
import type { GroceryList } from '../../domain/grocery-list';

const week: GroceryList = {
  startDate: '2026-09-28',
  items: [
    { name: 'Hähnchenbrust', unit: 'g', amount: 800, untracked: false, dates: ['2026-09-29', '2026-10-01'] },
    { name: 'Olivenöl', unit: 'ml', amount: 30, untracked: false, dates: ['2026-09-29'] },
    {
      name: 'Zwiebel',
      unit: 'g',
      amount: 380,
      untracked: false,
      dates: ['2026-09-28', '2026-09-29', '2026-10-01'],
      pieceHint: { count: 3, label: 'mittel' },
    },
    { name: 'Salz', unit: 'g', amount: 5, untracked: true, dates: ['2026-09-29'] },
  ],
  skippedQuickEntries: 2,
};

function serve(list: GroceryList) {
  let requested: string | undefined;
  server.use(
    http.get('/api/grocery-list/:startDate', ({ params }) => {
      requested = params['startDate'] as string;
      return HttpResponse.json(list);
    }),
  );
  return () => requested;
}

function renderSheet(writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()) {
  const onClose = vi.fn<() => void>();
  renderWithProviders(
    <GroceryListSheet
      startDate="2026-09-28"
      rangeLabel="28. September – 4. Oktober"
      onClose={onClose}
      writeClipboard={writeClipboard}
    />,
    { queryClient: createTestQueryClient() },
  );
  return { writeClipboard, onClose };
}

describe('GroceryListSheet', () => {
  it('loads the list for its week and shows the range in the title', async () => {
    const requested = serve(week);
    renderSheet();

    expect(await screen.findByText('Hähnchenbrust')).toBeInTheDocument();
    expect(requested()).toBe('2026-09-28');
    expect(screen.getByRole('heading', { name: 'Einkaufsliste · 28. September – 4. Oktober' })).toBeInTheDocument();
  });

  it('shows amount, piece hint and weekdays per item', async () => {
    serve(week);
    renderSheet();

    const zwiebel = (await screen.findByText('Zwiebel')).closest('label')!;
    expect(within(zwiebel).getByText('380 g · ≈ 3 Stück')).toBeInTheDocument();
    expect(within(zwiebel).getByText('Mo, Di, Do')).toBeInTheDocument();
  });

  it('lists untracked items under their own heading after the tracked ones', async () => {
    serve(week);
    renderSheet();

    await screen.findByText('Salz');
    const names = screen
      .getAllByRole('checkbox')
      .map((c) => c.closest('label')!.querySelector('[data-name]')!.textContent);
    expect(names).toEqual(['Hähnchenbrust', 'Olivenöl', 'Zwiebel', 'Salz']);
    const heading = screen.getByRole('heading', { name: 'Gewürze & Kleinkram' });
    expect(heading.compareDocumentPosition(screen.getByText('Salz')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      heading.compareDocumentPosition(screen.getByText('Zwiebel')) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  it('notes skipped quick entries', async () => {
    serve(week);
    renderSheet();

    expect(await screen.findByText('2 Schnelleinträge nicht enthalten')).toBeInTheDocument();
  });

  it('starts with every item checked', async () => {
    serve(week);
    renderSheet();

    await screen.findByText('Salz');
    expect(screen.getAllByRole('checkbox').every((c) => (c as HTMLInputElement).checked)).toBe(true);
  });

  it('copies only the checked items, one per line, and confirms', async () => {
    serve(week);
    const { writeClipboard } = renderSheet();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Olivenöl einkaufen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));

    await waitFor(() =>
      expect(writeClipboard).toHaveBeenCalledWith('Hähnchenbrust — 800 g\nZwiebel — 380 g (≈ 3 Stück)\nSalz — 5 g'),
    );
    expect(await screen.findByText('In die Zwischenablage kopiert')).toBeInTheDocument();
  });

  it('shows an error when the clipboard write fails', async () => {
    serve(week);
    renderSheet(vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('denied')));

    await screen.findByText('Salz');
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));

    expect(await screen.findByText('Kopieren fehlgeschlagen')).toBeInTheDocument();
    expect(screen.queryByText('In die Zwischenablage kopiert')).not.toBeInTheDocument();
  });

  it('disables Kopieren when nothing is checked', async () => {
    serve({ ...week, items: [week.items[0]!] });
    renderSheet();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Hähnchenbrust einkaufen' }));

    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeDisabled();
  });

  it('shows an empty state with Kopieren disabled for an empty week', async () => {
    serve({ startDate: '2026-09-28', items: [], skippedQuickEntries: 0 });
    renderSheet();

    expect(await screen.findByText('Für diese Woche ist noch nichts geplant.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeDisabled();
  });

  it('lists an item without an amount by name only', async () => {
    serve({ ...week, items: [{ name: 'Pfeffer', unit: 'g', amount: 0, untracked: true, dates: ['2026-09-29'] }] });
    const { writeClipboard } = renderSheet();

    await screen.findByText('Pfeffer');
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));

    await waitFor(() => expect(writeClipboard).toHaveBeenCalledWith('Pfeffer'));
  });
});
