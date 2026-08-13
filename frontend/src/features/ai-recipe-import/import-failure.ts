import { ApiError } from '../../api/client';
import { ImportNotConfiguredError } from '../../api/import-recipe-from-photos';
import { de } from '../../i18n/de';

const f = de.aiRecipeImport.failure;

/** The client gave up waiting for the vision call — distinct from the user cancelling it. */
export class ImportTimeoutError extends Error {
  constructor() {
    super('Recipe import timed out');
    this.name = 'ImportTimeoutError';
  }
}

/** The user (or an unmount) aborted the import — never rendered as a failure. */
export class ImportCancelledError extends Error {
  constructor() {
    super('Recipe import cancelled');
    this.name = 'ImportCancelledError';
  }
}

export interface ImportFailure {
  /** What went wrong, in the user's terms. */
  message: string;
  /** What to do about it. */
  hint: string;
  /** Whether re-sending the same photos can plausibly succeed. */
  canRetry: boolean;
}

/**
 * Turns whatever the import path threw into a German message that names the problem
 * and the recovery. Raw `Error.message` values here are server or fetch internals
 * ("Failed to fetch", "ai-extraction-failed") and must never reach the screen.
 */
export function describeImportFailure(error: unknown): ImportFailure {
  if (error instanceof ImportNotConfiguredError) {
    return { message: de.aiRecipeImport.notConfigured, hint: f.notConfiguredHint, canRetry: false };
  }

  // A bare AbortError means the browser aborted without our reason surviving — treat the
  // only abort the user does not initiate, the timeout, as the explanation.
  if (error instanceof ImportTimeoutError || (error instanceof Error && error.name === 'AbortError')) {
    return { message: f.timeout, hint: f.timeoutHint, canRetry: true };
  }

  if (error instanceof ApiError) {
    return describeApiError(error);
  }

  if (isOffline()) {
    return { message: f.offline, hint: f.offlineHint, canRetry: true };
  }

  // `fetch` rejects with a TypeError for DNS, CORS, TLS and dropped connections.
  if (error instanceof TypeError) {
    return { message: f.network, hint: f.networkHint, canRetry: true };
  }

  return { message: f.generic, hint: f.genericHint, canRetry: true };
}

function describeApiError(error: ApiError): ImportFailure {
  if (error.status === 401 || error.status === 403) {
    return { message: f.unauthorized, hint: f.unauthorizedHint, canRetry: false };
  }
  if (error.status === 413) {
    return { message: f.tooLarge, hint: f.tooLargeHint, canRetry: true };
  }
  if (error.status === 429) {
    return { message: f.rateLimited, hint: f.rateLimitedHint, canRetry: true };
  }
  if (error.message === 'ai-extraction-failed' || error.status === 502) {
    return { message: f.extraction, hint: f.extractionHint, canRetry: true };
  }
  if (error.status >= 500) {
    return { message: f.server, hint: f.serverHint, canRetry: true };
  }
  if (error.status >= 400) {
    return { message: f.invalid, hint: f.invalidHint, canRetry: true };
  }
  return { message: f.generic, hint: f.genericHint, canRetry: true };
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
