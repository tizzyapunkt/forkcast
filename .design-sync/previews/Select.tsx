import { useState } from 'react';
import { Field, Select } from '@forkcast/frontend';

export function InField() {
  const [value, setValue] = useState('moderate');
  return (
    <div className="w-64">
      <Field label="Aktivität" htmlFor="preview-activity" hint="Bewegung an einem Durchschnittstag">
        <Select id="preview-activity" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="sedentary">Sitzend</option>
          <option value="light">Leicht aktiv</option>
          <option value="moderate">Mäßig aktiv</option>
          <option value="high">Sehr aktiv</option>
        </Select>
      </Field>
    </div>
  );
}

export function WithError() {
  return (
    <div className="w-64">
      <Field label="Zielphase" htmlFor="preview-phase" error="Bitte eine Phase wählen">
        <Select id="preview-phase" defaultValue="">
          <option value="" disabled>
            Bitte wählen
          </option>
          <option value="cut">Defizit</option>
          <option value="maintain">Erhalt</option>
          <option value="bulk">Aufbau</option>
        </Select>
      </Field>
    </div>
  );
}

export function Standalone() {
  const [unit, setUnit] = useState('g');
  return (
    <div className="w-32">
      <Select aria-label="Einheit" value={unit} onChange={(e) => setUnit(e.target.value)}>
        <option value="g">g</option>
        <option value="ml">ml</option>
      </Select>
    </div>
  );
}

export function Dense() {
  return (
    <div className="w-32">
      <Select aria-label="Einheit" size="sm" defaultValue="ml">
        <option value="g">g</option>
        <option value="ml">ml</option>
      </Select>
    </div>
  );
}
