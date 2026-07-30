import { render, screen } from '@testing-library/react';
import { Field } from './field';
import { Input } from './input';

describe('Field', () => {
  it('associates its label with the control it wraps', () => {
    render(
      <Field label="Kalorien">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Kalorien')).toBeInstanceOf(HTMLInputElement);
  });

  it('keeps an explicit id on the control instead of generating one', () => {
    render(
      <Field label="Kalorien" htmlFor="calories">
        <Input id="calories" />
      </Field>,
    );
    expect(screen.getByLabelText('Kalorien')).toHaveAttribute('id', 'calories');
  });

  it('renders no error message when the field is valid', () => {
    render(
      <Field label="Kalorien">
        <Input />
      </Field>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Kalorien')).not.toHaveAttribute('aria-invalid');
  });

  it('announces a validation error on the control it wraps', () => {
    render(
      <Field label="Kalorien" error="Kalorien sind erforderlich">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Kalorien');
    const error = screen.getByRole('alert');

    expect(error).toHaveTextContent('Kalorien sind erforderlich');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Kalorien sind erforderlich');
  });

  it('renders a quieter, smaller label with size="sm" for dense grids', () => {
    const { rerender } = render(
      <Field label="Eiweiß">
        <Input />
      </Field>,
    );
    const defaultLabel = screen.getByText('Eiweiß').className;

    rerender(
      <Field label="Eiweiß" size="sm">
        <Input />
      </Field>,
    );
    const denseLabel = screen.getByText('Eiweiß').className;

    expect(denseLabel).not.toBe(defaultLabel);
    expect(denseLabel).toContain('text-xs');
    expect(screen.getByLabelText('Eiweiß')).toBeInstanceOf(HTMLInputElement);
  });

  it('renders an optional hint that describes the control', () => {
    render(
      <Field label="Menge" hint="in Gramm">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Menge')).toHaveAccessibleDescription('in Gramm');
  });

  it('describes the control by both hint and error while invalid', () => {
    render(
      <Field label="Menge" hint="in Gramm" error="Pflichtfeld">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Menge')).toHaveAccessibleDescription('in Gramm Pflichtfeld');
  });
});
