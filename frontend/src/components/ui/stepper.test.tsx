import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Stepper } from './stepper';

function Harness({ initial = 2, min, max }: { initial?: number; min?: number; max?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <Stepper
      value={value}
      onChange={setValue}
      label="Portionen"
      decrementLabel="Eine Portion weniger"
      incrementLabel="Eine Portion mehr"
      min={min}
      max={max}
    />
  );
}

describe('Stepper', () => {
  it('shows the value as a labelled number', () => {
    render(<Harness initial={3} />);
    expect(screen.getByLabelText('Portionen')).toHaveValue(3);
  });

  it('steps up and down', async () => {
    render(<Harness initial={2} />);

    await userEvent.click(screen.getByRole('button', { name: 'Eine Portion mehr' }));
    expect(screen.getByLabelText('Portionen')).toHaveValue(3);

    await userEvent.click(screen.getByRole('button', { name: 'Eine Portion weniger' }));
    await userEvent.click(screen.getByRole('button', { name: 'Eine Portion weniger' }));
    expect(screen.getByLabelText('Portionen')).toHaveValue(1);
  });

  it('stops at min and max', async () => {
    render(<Harness initial={1} min={1} max={2} />);

    expect(screen.getByRole('button', { name: 'Eine Portion weniger' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Eine Portion mehr' }));
    expect(screen.getByLabelText('Portionen')).toHaveValue(2);
    expect(screen.getByRole('button', { name: 'Eine Portion mehr' })).toBeDisabled();
  });

  it('defaults to a minimum of 0', async () => {
    render(<Harness initial={0} />);
    expect(screen.getByRole('button', { name: 'Eine Portion weniger' })).toBeDisabled();
  });
});
