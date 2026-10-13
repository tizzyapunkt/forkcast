import { resetDemoStore } from './indexeddb-json-document';

/** Discards the demo data and reloads; the next start seeds afresh in the active language. */
export async function resetDemo(): Promise<void> {
  await resetDemoStore();
  location.reload();
}
