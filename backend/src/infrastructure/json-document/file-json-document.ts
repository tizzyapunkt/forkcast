import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { JsonDocument } from './json-document.ts';

/**
 * A JSON document stored as a file. Writes create the directory if needed and
 * go through a temp file plus rename, so a crash never leaves a half-written file.
 */
export class FileJsonDocument implements JsonDocument {
  constructor(readonly location: string) {}

  async read(): Promise<string | null> {
    if (!existsSync(this.location)) return null;
    return readFile(this.location, 'utf-8');
  }

  async write(text: string): Promise<void> {
    await mkdir(dirname(this.location), { recursive: true });
    const tmpPath = `${this.location}.tmp`;
    await writeFile(tmpPath, text, 'utf-8');
    await rename(tmpPath, this.location);
  }
}
