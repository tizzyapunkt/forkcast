import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader } from './app-header';

describe('AppHeader', () => {
  it('renders the forkcast wordmark when no title is given', () => {
    render(<AppHeader />);
    expect(screen.getByRole('heading', { name: 'forkcast' })).toBeInTheDocument();
  });

  it('renders a screen title instead of the wordmark when given', () => {
    render(<AppHeader title="Rezepte" />);
    expect(screen.getByRole('heading', { name: 'Rezepte' })).toBeInTheDocument();
    expect(screen.queryByText('forkcast')).not.toBeInTheDocument();
  });

  it('renders an optional subtitle under the title', () => {
    render(<AppHeader title="Bolognese" subtitle="Ergibt 4 Portionen" />);
    expect(screen.getByText('Ergibt 4 Portionen')).toBeInTheDocument();
  });

  it('renders no back button without onBack', () => {
    render(<AppHeader title="Rezepte" />);
    expect(screen.queryByRole('button', { name: /zurück/i })).not.toBeInTheDocument();
  });

  it('renders an accessible back button inside the header that fires onBack', async () => {
    const onBack = vi.fn<() => void>();
    render(<AppHeader title="Bolognese" onBack={onBack} backAria="Zurück zu Rezepten" />);
    const back = screen.getByRole('button', { name: 'Zurück zu Rezepten' });
    expect(back.closest('header')).not.toBeNull();
    await userEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('places the back button before the title in the header layout', () => {
    render(<AppHeader title="Bolognese" onBack={() => {}} />);
    const header = screen.getByRole('banner');
    const back = screen.getByRole('button', { name: /zurück/i });
    const title = screen.getByRole('heading', { name: 'Bolognese' });
    const position = back.compareDocumentPosition(title);
    // The title FOLLOWS the back arrow in document order.
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(header).toContainElement(back);
  });

  it('lets a long title wrap instead of truncating', () => {
    render(<AppHeader title="Rinderhackbällchen mit Teriyaki Sauce und Sushireis" onBack={() => {}} />);
    const title = screen.getByRole('heading', { name: /Rinderhackbällchen/ });
    expect(title.className).not.toMatch(/truncate/);
  });

  it('renders children and bottom slots', () => {
    render(
      <AppHeader bottom={<div data-testid="bottom-slot" />}>
        <div data-testid="children-slot" />
      </AppHeader>,
    );
    expect(screen.getByTestId('children-slot')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-slot')).toBeInTheDocument();
  });

  it('keeps the sticky positioning', () => {
    render(<AppHeader title="Einstellungen" />);
    expect(screen.getByRole('banner').className).toMatch(/sticky/);
  });
});
