import { useState } from 'react';
import { Input } from '@forkcast/frontend';

export function Default() {
  const [value, setValue] = useState('Haferflocken');
  return <Input value={value} onChange={(e) => setValue(e.target.value)} className="w-64" />;
}

export function Sizes() {
  const [value, setValue] = useState('180');
  return (
    <div className="flex flex-col gap-2">
      <Input size="md" value={value} onChange={(e) => setValue(e.target.value)} className="w-40" />
      <Input size="sm" value={value} onChange={(e) => setValue(e.target.value)} className="w-40" />
    </div>
  );
}

export function Numeric() {
  const [value, setValue] = useState('612');
  return <Input numeric value={value} onChange={(e) => setValue(e.target.value)} className="w-24" />;
}

export function Invalid() {
  return <Input defaultValue="" aria-invalid className="w-64" placeholder="Größe (cm)" />;
}
