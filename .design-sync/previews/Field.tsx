import { useState } from 'react';
import { Field, Input, DecimalInput, SegmentedControl } from '@forkcast/frontend';

export function WithInput() {
  const [value, setValue] = useState('180');
  return (
    <div className="w-64">
      <Field label="Größe (cm)" htmlFor="preview-height">
        <Input
          id="preview-height"
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full"
        />
      </Field>
    </div>
  );
}

export function WithHint() {
  const [value, setValue] = useState<number | null>(78.4);
  return (
    <div className="w-64">
      <Field label="Gewicht (kg)" htmlFor="preview-weight" hint="7-Tage-Mittel: 78.1 kg">
        <DecimalInput id="preview-weight" value={value} onValueChange={setValue} className="w-full" />
      </Field>
    </div>
  );
}

export function WithError() {
  return (
    <div className="w-64">
      <Field label="Alter (Jahre)" htmlFor="preview-age" error="Pflichtfeld">
        <Input id="preview-age" type="number" inputMode="numeric" defaultValue="" className="w-full" />
      </Field>
    </div>
  );
}

export function WithSegmentedControl() {
  const [value, setValue] = useState<'male' | 'female'>('female');
  return (
    <div className="w-64">
      <Field label="Geschlecht" htmlFor="preview-sex">
        <SegmentedControl
          label="Geschlecht"
          value={value}
          onChange={setValue}
          options={[
            { value: 'male', label: 'Männlich' },
            { value: 'female', label: 'Weiblich' },
          ]}
        />
      </Field>
    </div>
  );
}
