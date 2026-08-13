import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ErrorBoundary } from './error-boundary';

function Boom({ throws }: { throws: boolean }): React.ReactElement {
  if (throws) throw new Error('synonyms is not iterable');
  return <p>Alles gut</p>;
}

/** React logs every caught render error; silence it so the suite output stays readable. */
const silenceReactError = () => vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it('renders its children while nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Alles gut')).toBeInTheDocument();
  });

  it('shows the failure and its message instead of a blank screen', () => {
    silenceReactError();
    render(
      <ErrorBoundary>
        <Boom throws={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/etwas ist schiefgelaufen/i);
    expect(screen.getByText(/synonyms is not iterable/)).toBeInTheDocument();
  });

  it('recovers into a working screen once the user retries', async () => {
    silenceReactError();
    function Host() {
      const [throws, setThrows] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setThrows(false)}>
            reparieren
          </button>
          <ErrorBoundary>
            <Boom throws={throws} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Host />);

    await userEvent.click(screen.getByRole('button', { name: 'reparieren' }));
    await userEvent.click(screen.getByRole('button', { name: /erneut versuchen/i }));

    expect(screen.getByText('Alles gut')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
