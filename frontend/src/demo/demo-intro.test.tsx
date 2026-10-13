import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { DemoIntro, INTRO_SEEN_KEY } from './demo-intro';
import { resetDemoStore } from './indexeddb-json-document';

describe('DemoIntro', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(INTRO_SEEN_KEY);
  });

  it('explains the demo on the first visit, naming what is turned off', () => {
    render(<DemoIntro />);

    const dialog = screen.getByRole('dialog', { name: 'Das ist eine Demo' });
    expect(dialog).toHaveTextContent('komplett in deinem Browser');
    expect(dialog).toHaveTextContent('Rezept-Import aus Fotos');
    expect(dialog).toHaveTextContent('Senden an Bring!');
  });

  it('credits Open Food Facts and the ODbL for the product search', () => {
    render(<DemoIntro />);

    expect(screen.getByText(/Die Produktsuche nutzt einen Schnappschuss von/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Food Facts' })).toHaveAttribute(
      'href',
      'https://world.openfoodfacts.org',
    );
    expect(screen.getByRole('link', { name: 'ODbL' })).toHaveAttribute(
      'href',
      'https://opendatacommons.org/licenses/odbl/1-0/',
    );
  });

  it('closes on "Verstanden" and stays closed on the next visit', async () => {
    const { unmount } = render(<DemoIntro />);
    await userEvent.click(screen.getByRole('button', { name: 'Verstanden' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    render(<DemoIntro />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays closed after a demo reset', async () => {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
    await resetDemoStore(new IDBFactory());

    render(<DemoIntro />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('still opens and closes when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    render(<DemoIntro />);
    await userEvent.click(screen.getByRole('button', { name: 'Verstanden' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
