import { fetchJson } from './client';

export interface BringImportTokenInput {
  startDate: string;
  /** Identities (case-insensitive name + unit) of the items unticked in the sheet. */
  excluded: string[];
}

/** Mints the one-hour token that lets Bring!'s servers fetch this week's list. */
export function mintBringImportToken(input: BringImportTokenInput): Promise<{ token: string }> {
  return fetchJson<{ token: string }>('/api/bring-import-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
