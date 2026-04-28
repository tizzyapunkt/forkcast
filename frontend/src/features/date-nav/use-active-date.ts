import { useState } from 'react';
import { addDays, today } from '../../domain/date';

export function useActiveDate(initialDate?: string) {
  const [date, setDate] = useState(initialDate ?? today());

  return {
    date,
    goPrev: () => setDate((d) => addDays(d, -1)),
    goNext: () => setDate((d) => addDays(d, 1)),
    goToday: () => setDate(today()),
  };
}
