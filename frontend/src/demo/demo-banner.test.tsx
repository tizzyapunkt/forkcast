import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoBanner } from './demo-banner';
import { resetDemo } from './reset-demo';

vi.mock('./reset-demo', () => ({ resetDemo: vi.fn<() => Promise<void>>(async () => {}) }));

describe('DemoBanner', () => {
  beforeEach(() => vi.mocked(resetDemo).mockClear());

  it('says it is a demo and offers a reset', async () => {
    render(<DemoBanner seededLocale="de" />);

    expect(screen.getByText('Demo – deine Daten bleiben in diesem Browser.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Demo zurücksetzen' }));
    expect(resetDemo).toHaveBeenCalledOnce();
  });

  it('offers no language reset when the data is in the active language', () => {
    render(<DemoBanner seededLocale="de" />);

    expect(screen.queryByRole('button', { name: 'Demo auf Deutsch zurücksetzen' })).not.toBeInTheDocument();
  });

  it('offers a reset in the active language when the data was seeded in the other one', async () => {
    render(<DemoBanner seededLocale="en" />);

    expect(screen.getByText('Die Beispieldaten sind auf Englisch.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Demo auf Deutsch zurücksetzen' }));
    expect(resetDemo).toHaveBeenCalledOnce();
  });
});
