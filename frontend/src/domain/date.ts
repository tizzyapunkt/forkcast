export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatISODate(d);
}

export function today(): string {
  return formatISODate(new Date());
}

/** The Monday (ISO date) of the week containing `dateStr`. Weeks run Monday–Sunday. */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dateStr, offset);
}
