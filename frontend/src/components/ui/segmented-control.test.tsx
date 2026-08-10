import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SegmentedControl } from './segmented-control';

const UNITS = [
  { value: 'g' as const, label: 'g' },
  { value: 'ml' as const, label: 'ml' },
];

function Harness({ initial = 'g' as 'g' | 'ml' }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SegmentedControl label="Einheit" value={value} onChange={setValue} options={UNITS} />
      <output data-testid="picked">{value}</output>
    </>
  );
}

describe('SegmentedControl', () => {
  it('exposes the options as a named radio group', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Einheit' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('marks the option matching the current value as selected', () => {
    render(<Harness initial="ml" />);
    expect(screen.getByRole('radio', { name: 'ml' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'g' })).not.toBeChecked();
  });

  it('reports the picked value when an option is chosen', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'ml' }));
    expect(screen.getByTestId('picked')).toHaveTextContent('ml');
    expect(screen.getByRole('radio', { name: 'ml' })).toBeChecked();
  });

  it('keeps two controls on the same screen independent', async () => {
    render(
      <>
        <Harness />
        <SegmentedControl
          label="Richtung"
          value="deficit"
          onChange={() => {}}
          options={[
            { value: 'deficit', label: 'Defizit' },
            { value: 'surplus', label: 'Überschuss' },
          ]}
        />
      </>,
    );

    // Radios grouped by a shared `name` would deselect each other across controls.
    await userEvent.click(screen.getByRole('radio', { name: 'ml' }));
    expect(screen.getByRole('radio', { name: 'ml' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Defizit' })).toBeChecked();
  });

  it('styles the selected option differently from the others', () => {
    render(<Harness initial="g" />);
    const selected = screen.getByRole('radio', { name: 'g' }).closest('label');
    const other = screen.getByRole('radio', { name: 'ml' }).closest('label');
    expect(selected?.className).not.toBe(other?.className);
  });

  it('renders a disabled control that cannot be changed', async () => {
    const onChange = vi.fn<(v: string) => void>();
    render(
      <SegmentedControl
        label="Richtung"
        value="deficit"
        onChange={onChange}
        disabled
        options={[
          { value: 'deficit', label: 'Defizit' },
          { value: 'surplus', label: 'Überschuss' },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Überschuss' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
