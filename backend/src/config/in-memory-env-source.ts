import type { EnvSource } from './env-source.ts';

/**
 * Test fake — backs `EnvSource` with a plain Map, so tests can describe
 * configuration scenarios without touching `process.env`.
 */
export class InMemoryEnvSource implements EnvSource {
  private readonly values: Map<string, string>;

  constructor(values: Record<string, string> = {}) {
    this.values = new Map(Object.entries(values));
  }

  get(key: string): string | undefined {
    return this.values.get(key);
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}
