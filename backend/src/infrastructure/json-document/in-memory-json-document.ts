import type { JsonDocument } from './json-document.ts';

/** A JSON document held in memory: for tests, and for anything that must not touch disk. */
export class InMemoryJsonDocument implements JsonDocument {
  constructor(
    private text: string | null = null,
    readonly location: string = 'memory',
  ) {}

  async read(): Promise<string | null> {
    return this.text;
  }

  async write(text: string): Promise<void> {
    this.text = text;
  }
}
