import { useState } from 'react';
import { Stepper } from '@forkcast/frontend';

export function Dense() {
  const [value, setValue] = useState(4);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Portionen</span>
      <Stepper
        value={value}
        onChange={setValue}
        min={1}
        label="Portionen"
        decrementLabel="Eine Portion weniger"
        incrementLabel="Eine Portion mehr"
      />
    </div>
  );
}

export function Touch() {
  const [value, setValue] = useState(2);
  return (
    <div className="flex w-72 items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">Essen mit</div>
        <div className="text-xs text-muted-foreground">Portionen, die nicht im Plan stehen</div>
      </div>
      <Stepper
        size="touch"
        value={value}
        onChange={setValue}
        label="Essen mit"
        decrementLabel="Eine Portion weniger"
        incrementLabel="Eine Portion mehr"
      />
    </div>
  );
}

export function AtMinimum() {
  return (
    <Stepper
      size="touch"
      value={0}
      onChange={() => {}}
      label="Essen mit"
      decrementLabel="Eine Portion weniger"
      incrementLabel="Eine Portion mehr"
    />
  );
}
