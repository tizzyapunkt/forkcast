export interface Initializable {
  init(): Promise<void>;
}

/**
 * Runs startup-time setup for every adapter that needs it (e.g. loading the
 * catalog into memory). Rejects when any part fails.
 */
export async function bootstrap(parts: Initializable[]): Promise<void> {
  await Promise.all(parts.map((p) => p.init()));
}
