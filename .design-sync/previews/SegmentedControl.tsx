import { useState } from 'react';
import { SegmentedControl } from '@forkcast/frontend';

const SEX_OPTIONS = [
  { value: 'male', label: 'Männlich' },
  { value: 'female', label: 'Weiblich' },
] as const;

const DIRECTION_OPTIONS = [
  { value: 'deficit', label: 'Defizit' },
  { value: 'surplus', label: 'Überschuss' },
] as const;

export function TwoOptions() {
  const [value, setValue] = useState<(typeof SEX_OPTIONS)[number]['value']>('female');
  return (
    <SegmentedControl label="Geschlecht" value={value} onChange={setValue} options={SEX_OPTIONS} className="w-64" />
  );
}

export function Selected() {
  const [value, setValue] = useState<(typeof DIRECTION_OPTIONS)[number]['value']>('deficit');
  return (
    <SegmentedControl
      label="Anpassungsrichtung"
      value={value}
      onChange={setValue}
      options={DIRECTION_OPTIONS}
      className="w-64"
    />
  );
}

export function Disabled() {
  return (
    <SegmentedControl
      label="Geschlecht"
      value="male"
      onChange={() => {}}
      options={SEX_OPTIONS}
      disabled
      className="w-64"
    />
  );
}
