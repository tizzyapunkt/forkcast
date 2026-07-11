import { fetchJson } from './client';

export interface ServerLogEntry {
  at: string;
  kind: 'http' | 'error' | 'off';
  message: string;
  detail?: string;
}

export async function fetchDebugLogs(): Promise<ServerLogEntry[]> {
  const body = await fetchJson<{ entries: ServerLogEntry[] }>('/api/debug/logs');
  return body.entries;
}
