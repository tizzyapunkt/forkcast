import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Banner } from './banner';

describe('Banner', () => {
  it('announces a failure as an alert', () => {
    render(<Banner tone="error">Der Import ist fehlgeschlagen.</Banner>);

    expect(screen.getByRole('alert')).toHaveTextContent('Der Import ist fehlgeschlagen.');
  });

  it('announces a passive confirmation as a status, not an alert', () => {
    render(<Banner tone="success">Gespeichert.</Banner>);

    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('pairs the message with the recovery hint', () => {
    render(
      <Banner tone="error" hint="Versuche es erneut.">
        Der Server war nicht erreichbar.
      </Banner>,
    );

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('Der Server war nicht erreichbar.');
    expect(banner).toHaveTextContent('Versuche es erneut.');
  });

  it('carries the recovery control inside itself', async () => {
    const onRetry = vi.fn<() => void>();
    render(
      <Banner tone="error" action={<button onClick={onRetry}>Erneut versuchen</button>}>
        Fehlgeschlagen.
      </Banner>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('dismisses only when a handler is given', async () => {
    const onDismiss = vi.fn<() => void>();
    const { rerender } = render(<Banner tone="warning">Hinweis</Banner>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <Banner tone="warning" onDismiss={onDismiss} dismissLabel="Hinweise ausblenden">
        Hinweis
      </Banner>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hinweise ausblenden' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('styles each tone differently', () => {
    const { rerender } = render(<Banner tone="error">x</Banner>);
    const error = screen.getByRole('alert').className;
    rerender(<Banner tone="warning">x</Banner>);
    const warning = screen.getByRole('status').className;
    rerender(<Banner tone="success">x</Banner>);
    const success = screen.getByRole('status').className;

    expect(new Set([error, warning, success]).size).toBe(3);
  });

  it('offers a dense variant for tight surfaces', () => {
    const { rerender } = render(<Banner tone="error">x</Banner>);
    const md = screen.getByRole('alert').className;
    rerender(
      <Banner tone="error" density="sm">
        x
      </Banner>,
    );

    expect(screen.getByRole('alert').className).not.toBe(md);
  });

  it('lets a caller override the announced role', () => {
    render(
      <Banner tone="error" role="status">
        x
      </Banner>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
