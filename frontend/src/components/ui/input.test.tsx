import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input';

describe('Input', () => {
  it('renders an editable text box', async () => {
    render(<Input aria-label="Bezeichnung" />);
    const input = screen.getByRole('textbox', { name: 'Bezeichnung' });
    await userEvent.type(input, 'Haferflocken');
    expect(input).toHaveValue('Haferflocken');
  });

  it('forwards arbitrary input attributes', () => {
    render(<Input aria-label="Menge" inputMode="decimal" placeholder="0" />);
    const input = screen.getByRole('textbox', { name: 'Menge' });
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('placeholder', '0');
  });

  it('keeps a 16px font on mobile so iOS does not zoom on focus', () => {
    render(<Input aria-label="Bezeichnung" />);
    // `text-base` is 16px; the `sm:` breakpoint drops it back to 14px on wider screens.
    // Anything below 16px makes mobile Safari zoom the viewport when the field takes focus.
    expect(screen.getByRole('textbox').className).toMatch(/(^|\s)text-base(\s|$)/);
  });

  it('right-aligns numeric fields with tabular figures', () => {
    render(<Input aria-label="Gewicht" numeric />);
    const className = screen.getByRole('textbox').className;
    expect(className).toContain('text-right');
    expect(className).toContain('tabular-nums');
  });

  it('lets a caller-supplied class win over the size default', () => {
    render(<Input aria-label="Menge" className="px-8" />);
    const className = screen.getByRole('textbox').className;
    expect(className).toContain('px-8');
    expect(className).not.toMatch(/(^|\s)px-3(\s|$)/);
  });

  it('forwards a ref to the underlying input', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} aria-label="Menge" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
