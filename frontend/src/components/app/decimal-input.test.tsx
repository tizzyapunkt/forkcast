import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DecimalInput } from './decimal-input';

function Harness({ initial = 0, locale = 'de-DE' }: { initial?: number | null; locale?: string }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <DecimalInput aria-label="amount" value={value} locale={locale} onValueChange={setValue} />
      <output data-testid="committed">{value === null ? 'null' : value}</output>
    </>
  );
}

describe('DecimalInput', () => {
  it('renders a text input with a decimal input mode (not a strict number field)', () => {
    render(<Harness />);
    const input = screen.getByLabelText('amount');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputMode', 'decimal');
  });

  it('shows the value formatted in the active locale', () => {
    render(<Harness initial={0.25} locale="de-DE" />);
    expect(screen.getByLabelText('amount')).toHaveValue('0,25');
  });

  it('accepts a comma-delimited decimal and commits the parsed number', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('amount');
    await userEvent.clear(input);
    await userEvent.type(input, '0,25');
    expect(input).toHaveValue('0,25');
    expect(screen.getByTestId('committed')).toHaveTextContent('0.25');
  });

  it('accepts a dot-delimited decimal as well', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('amount');
    await userEvent.clear(input);
    await userEvent.type(input, '1.5');
    expect(screen.getByTestId('committed')).toHaveTextContent('1.5');
  });

  it('keeps an in-progress entry on screen without committing an invalid value', async () => {
    render(<Harness initial={3} />);
    const input = screen.getByLabelText('amount');
    await userEvent.clear(input);
    await userEvent.type(input, '0,');
    expect(input).toHaveValue('0,');
    // Nothing valid was lost: the last parseable value (0) is the committed one.
    expect(screen.getByTestId('committed')).toHaveTextContent('0');
  });

  it('reformats to the committed value on blur', async () => {
    render(<Harness initial={2} locale="de-DE" />);
    const input = screen.getByLabelText('amount');
    await userEvent.clear(input);
    await userEvent.type(input, '1,50');
    fireEvent.blur(input);
    expect(input).toHaveValue('1,5');
  });

  it('renders an empty field for a null value', () => {
    render(<Harness initial={null} />);
    expect(screen.getByLabelText('amount')).toHaveValue('');
  });

  it('emits null when the field is cleared', async () => {
    render(<Harness initial={5} />);
    const input = screen.getByLabelText('amount');
    await userEvent.clear(input);
    expect(input).toHaveValue('');
    expect(screen.getByTestId('committed')).toHaveTextContent('null');
  });
});
