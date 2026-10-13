import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbJsonDocument, resetDemoStore } from './indexeddb-json-document';

describe('IndexedDbJsonDocument', () => {
  let factory: IDBFactory;

  beforeEach(() => {
    factory = new IDBFactory();
  });

  it('reads null for a document never written', async () => {
    expect(await new IndexedDbJsonDocument('recipes', factory).read()).toBeNull();
  });

  it('reads back what it wrote', async () => {
    const doc = new IndexedDbJsonDocument('recipes', factory);
    await doc.write('[{"id":"r1"}]');
    expect(await doc.read()).toBe('[{"id":"r1"}]');
  });

  it('keeps documents with different names apart', async () => {
    await new IndexedDbJsonDocument('recipes', factory).write('[1]');
    await new IndexedDbJsonDocument('weight-log', factory).write('[2]');

    expect(await new IndexedDbJsonDocument('recipes', factory).read()).toBe('[1]');
    expect(await new IndexedDbJsonDocument('weight-log', factory).read()).toBe('[2]');
  });

  it('names its location after the database and the document', () => {
    expect(new IndexedDbJsonDocument('recipes', factory).location).toBe('indexeddb:forkcast-demo/recipes');
  });

  it('starts empty again after resetDemoStore', async () => {
    const doc = new IndexedDbJsonDocument('recipes', factory);
    await doc.write('[1]');

    await resetDemoStore(factory);

    expect(await doc.read()).toBeNull();
  });
});
