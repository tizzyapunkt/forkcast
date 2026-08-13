import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomNav, type AppView } from './bottom-nav';

describe('BottomNav', () => {
  it('renders one tab per view', () => {
    render(<BottomNav active="log" onChange={vi.fn<(view: AppView) => void>()} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('marks the active tab as the current page', () => {
    render(<BottomNav active="planner" onChange={vi.fn<(view: AppView) => void>()} />);
    expect(screen.getByRole('button', { current: 'page' })).toHaveAccessibleName('Planen');
  });

  it('reports the picked view', async () => {
    const onChange = vi.fn<(view: AppView) => void>();
    render(<BottomNav active="log" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Rezepte' }));
    expect(onChange).toHaveBeenCalledWith('recipes');
  });

  it('keeps the tab row clear of the iOS home indicator', () => {
    // The nav is bottom-anchored in a viewport-fit=cover PWA, so the gesture bar
    // overlaps it unless the safe-area inset is padded out.
    render(<BottomNav active="log" onChange={vi.fn<(view: AppView) => void>()} />);
    expect(screen.getByRole('navigation').className).toContain('pb-safe-b');
  });
});
