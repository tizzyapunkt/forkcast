import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from './field';
import { Select } from './select';

function options() {
  return (
    <>
      <option value="g">g</option>
      <option value="ml">ml</option>
    </>
  );
}

describe('Select', () => {
  it('renders a native select the user can change', async () => {
    const onChange = vi.fn<() => void>();
    render(
      <Select aria-label="Einheit" defaultValue="g" onChange={onChange}>
        {options()}
      </Select>,
    );

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Einheit' }), 'ml');

    expect(screen.getByRole('combobox', { name: 'Einheit' })).toHaveValue('ml');
    expect(onChange).toHaveBeenCalled();
  });

  it('picks up the label, description and invalid state from a surrounding Field', () => {
    render(
      <Field label="Aktivität" hint="Bewegung an einem Durchschnittstag" error="Pflichtfeld">
        <Select>{options()}</Select>
      </Field>,
    );

    const select = screen.getByLabelText(/aktivität/i);
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('behaves like a plain select outside a Field', () => {
    render(
      <Select aria-label="Einheit" id="unit">
        {options()}
      </Select>,
    );

    const select = screen.getByRole('combobox', { name: 'Einheit' });
    expect(select).toHaveAttribute('id', 'unit');
    expect(select).not.toHaveAttribute('aria-invalid');
  });

  it('offers a dense size for inline rows', () => {
    const { rerender } = render(<Select aria-label="Einheit">{options()}</Select>);
    const md = screen.getByRole('combobox').className;
    rerender(
      <Select aria-label="Einheit" size="sm">
        {options()}
      </Select>,
    );

    expect(screen.getByRole('combobox').className).not.toBe(md);
  });

  it('forwards a ref so form libraries can register it', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select aria-label="Einheit" ref={ref}>
        {options()}
      </Select>,
    );

    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});
