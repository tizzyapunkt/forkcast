export interface Initializable {
  init(): Promise<void>;
}

/**
 * Runs startup-time setup for every persistence adapter (e.g. creating the
 * data directory). Safe to call multiple times.
 */
export async function bootstrap(parts: Initializable[]): Promise<void> {
  await Promise.all(parts.map((p) => p.init()));
}
