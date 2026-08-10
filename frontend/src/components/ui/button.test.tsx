import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders its label as a button', () => {
    render(<Button>Eintrag hinzufügen</Button>);
    expect(screen.getByRole('button', { name: 'Eintrag hinzufügen' })).toBeInTheDocument();
  });

  it('does not submit the surrounding form unless asked to', async () => {
    const onSubmit = vi.fn<() => void>();
    render(
      <form onSubmit={onSubmit}>
        <Button>Abbrechen</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the surrounding form with type="submit"', async () => {
    const onSubmit = vi.fn<(e: React.FormEvent) => void>((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Speichern</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('fires onClick', async () => {
    const onClick = vi.fn<() => void>();
    render(<Button onClick={onClick}>Zuordnen</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Zuordnen' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks while disabled', async () => {
    const onClick = vi.fn<() => void>();
    render(
      <Button onClick={onClick} disabled>
        Speichern
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards arbitrary button attributes', () => {
    render(<Button aria-label="Zutat entfernen" form="recipe-form" />);
    expect(screen.getByRole('button', { name: 'Zutat entfernen' })).toHaveAttribute('form', 'recipe-form');
  });

  it('styles each variant differently', () => {
    const { rerender } = render(<Button variant="primary">x</Button>);
    const primary = screen.getByRole('button').className;
    rerender(<Button variant="outline">x</Button>);
    const outline = screen.getByRole('button').className;
    rerender(<Button variant="destructive">x</Button>);
    const destructive = screen.getByRole('button').className;
    rerender(<Button variant="destructiveOutline">x</Button>);
    const destructiveOutline = screen.getByRole('button').className;
    rerender(<Button variant="ghost">x</Button>);
    const ghost = screen.getByRole('button').className;

    expect(new Set([primary, outline, destructive, destructiveOutline, ghost]).size).toBe(5);
  });

  it('lets a caller-supplied class win over the variant default', () => {
    render(
      <Button variant="primary" className="bg-warning">
        x
      </Button>,
    );
    const className = screen.getByRole('button').className;
    expect(className).toContain('bg-warning');
    expect(className).not.toMatch(/(^|\s)bg-primary(\s|$)/);
  });

  it('forwards a ref to the underlying button', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
