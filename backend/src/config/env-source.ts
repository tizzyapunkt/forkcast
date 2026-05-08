/**
 * Port for reading environment values. Adapters wrap concrete sources
 * (process.env populated by dotenv, in-memory maps for tests, ...).
 *
 * Keep this interface deliberately tiny — the typed AppConfig is built on
 * top of it by `loadAppConfig`, which is the only consumer the rest of the
 * app interacts with.
 */
export interface EnvSource {
  get(key: string): string | undefined;
}
