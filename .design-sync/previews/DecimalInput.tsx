import { useState } from 'react';
import { DecimalInput } from '@forkcast/frontend';

export function Default() {
  const [value, setValue] = useState<number | null>(78.4);
  return <DecimalInput value={value} onValueChange={setValue} className="w-32" />;
}

export function Empty() {
  const [value, setValue] = useState<number | null>(null);
  return <DecimalInput value={value} onValueChange={setValue} className="w-32" />;
}

export function GermanLocale() {
  const [value, setValue] = useState<number | null>(1.8);
  return <DecimalInput value={value} onValueChange={setValue} locale="de-DE" className="w-32" />;
}
