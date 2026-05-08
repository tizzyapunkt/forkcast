import { config as loadDotenv } from 'dotenv';
import type { EnvSource } from '../../config/env-source.ts';

export interface DotenvEnvSourceOptions {
  /** Path to the .env file. Defaults to dotenv's auto-detection (cwd + ".env"). */
  path?: string;
  /** Suppress dotenv's startup log line. Defaults to true. */
  quiet?: boolean;
}

/**
 * Adapter that loads a `.env` file into `process.env` (via dotenv) on
 * construction and exposes those values through the `EnvSource` port.
 *
 * Dotenv silently no-ops when the file is missing — that's the right
 * behavior for production where env vars come from the orchestrator and no
 * `.env` is shipped.
 */
export class DotenvEnvSource implements EnvSource {
  constructor(options: DotenvEnvSourceOptions = {}) {
    loadDotenv({
      path: options.path,
      quiet: options.quiet ?? true,
    });
  }

  get(key: string): string | undefined {
    return process.env[key];
  }
}
