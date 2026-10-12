import { describe, it, expect } from 'vite-plus/test';
import { InMemoryJsonDocument } from './in-memory-json-document.ts';

describe('InMemoryJsonDocument', () => {
  it('reads null when created empty', async () => {
    expect(await new InMemoryJsonDocument().read()).toBeNull();
  });

  it('reads its initial text', async () => {
    expect(await new InMemoryJsonDocument('[]').read()).toBe('[]');
  });

  it('reads back what was written', async () => {
    const doc = new InMemoryJsonDocument();
    await doc.write('{"a":1}');
    expect(await doc.read()).toBe('{"a":1}');
  });

  it('carries its location label', () => {
    expect(new InMemoryJsonDocument(null, 'recipes').location).toBe('recipes');
  });
});
