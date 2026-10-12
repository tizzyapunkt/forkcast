import { describe, it, expect, afterEach } from 'vite-plus/test';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileJsonDocument } from './file-json-document.ts';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'forkcast-doc-'));
  tmpDirs.push(dir);
  return dir;
}

describe('FileJsonDocument', () => {
  it('reads null when the file does not exist', async () => {
    const doc = new FileJsonDocument(join(freshDir(), 'missing.json'));
    expect(await doc.read()).toBeNull();
  });

  it('reads the stored text unchanged', async () => {
    const path = join(freshDir(), 'doc.json');
    writeFileSync(path, '[\n  1\n]\n', 'utf-8');
    expect(await new FileJsonDocument(path).read()).toBe('[\n  1\n]\n');
  });

  it('creates missing parent directories on write', async () => {
    const path = join(freshDir(), 'nested', 'deeper', 'doc.json');
    await new FileJsonDocument(path).write('{}');
    expect(readFileSync(path, 'utf-8')).toBe('{}');
  });

  it('replaces the file and leaves no temp file behind', async () => {
    const path = join(freshDir(), 'doc.json');
    writeFileSync(path, 'old', 'utf-8');
    const doc = new FileJsonDocument(path);
    await doc.write('new');
    expect(readFileSync(path, 'utf-8')).toBe('new');
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it('uses the path as its location', () => {
    expect(new FileJsonDocument('./data/recipes.json').location).toBe('./data/recipes.json');
  });
});
