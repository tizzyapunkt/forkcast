import type { JsonDocument } from '../../../backend/src/infrastructure/json-document/json-document.ts';

const DATABASE = 'forkcast-demo';
const STORE = 'documents';

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  return settle(request);
}

/**
 * One demo document as a text value in IndexedDB, keyed by its name. Each call opens and closes the
 * database, so `resetDemoStore` is never blocked by a connection left open.
 */
export class IndexedDbJsonDocument implements JsonDocument {
  readonly location: string;

  constructor(
    private readonly name: string,
    private readonly factory: IDBFactory = indexedDB,
  ) {
    this.location = `indexeddb:${DATABASE}/${name}`;
  }

  async read(): Promise<string | null> {
    const db = await open(this.factory);
    try {
      const value = await settle(db.transaction(STORE, 'readonly').objectStore(STORE).get(this.name));
      return typeof value === 'string' ? value : null;
    } finally {
      db.close();
    }
  }

  async write(text: string): Promise<void> {
    const db = await open(this.factory);
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(text, this.name);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}

/** Deletes every demo document: the next start seeds afresh. */
export async function resetDemoStore(factory: IDBFactory = indexedDB): Promise<void> {
  await settle(factory.deleteDatabase(DATABASE));
}
