import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FavoriteStar } from './favorite-star';

describe('FavoriteStar', () => {
  it('names the add action and the ingredient when not favorited', () => {
    render(<FavoriteStar name="Skyr" favorited={false} onToggle={vi.fn<() => void>()} />);

    expect(screen.getByRole('button', { name: '„Skyr“ zu Favoriten hinzufügen' })).toBeInTheDocument();
  });

  it('names the remove action and the ingredient when favorited', () => {
    render(<FavoriteStar name="Skyr" favorited onToggle={vi.fn<() => void>()} />);

    expect(screen.getByRole('button', { name: '„Skyr“ aus Favoriten entfernen' })).toBeInTheDocument();
  });

  it('reports its state to assistive tech', () => {
    const { rerender } = render(<FavoriteStar name="Skyr" favorited={false} onToggle={vi.fn<() => void>()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(<FavoriteStar name="Skyr" favorited onToggle={vi.fn<() => void>()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('fires the toggle on click', async () => {
    const onToggle = vi.fn<() => void>();
    render(<FavoriteStar name="Skyr" favorited={false} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not bubble the click to an enclosing row handler', async () => {
    const onRowClick = vi.fn<() => void>();
    const onToggle = vi.fn<() => void>();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div onClick={onRowClick}>
        <FavoriteStar name="Skyr" favorited={false} onToggle={onToggle} />
      </div>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
