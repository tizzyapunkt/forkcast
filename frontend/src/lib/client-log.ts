export type ClientLogKind = 'console' | 'error' | 'api';

export interface ClientLogEntry {
  at: string;
  kind: ClientLogKind;
  message: string;
  detail?: string;
}

const CAPACITY = 200;

const entries: ClientLogEntry[] = [];
let installed = false;
let recording = false;
let originalError: typeof console.error | undefined;
let originalWarn: typeof console.warn | undefined;

function record(kind: ClientLogKind, message: string, detail?: string): void {
  entries.push({ at: new Date().toISOString(), kind, message, detail });
  if (entries.length > CAPACITY) entries.splice(0, entries.length - CAPACITY);
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) return arg.message;
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

function captureConsole(args: unknown[]): void {
  // Re-entrancy guard: recording must never trigger another capture.
  if (recording) return;
  recording = true;
  try {
    record('console', args.map(formatArg).join(' '));
  } finally {
    recording = false;
  }
}

function onWindowError(event: ErrorEvent): void {
  record('error', event.message, event.error instanceof Error ? event.error.stack : undefined);
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason: unknown = event.reason;
  const message = reason instanceof Error ? reason.message : formatArg(reason);
  record('error', `Unhandled rejection: ${message}`, reason instanceof Error ? reason.stack : undefined);
}

export function recordApiFailure(method: string, path: string, reason: string): void {
  record('api', `${method} ${path} — ${reason}`);
}

export function clientLogEntries(): ClientLogEntry[] {
  return [...entries];
}

export function clearClientLog(): void {
  entries.length = 0;
}

export function installClientDiagnostics(): void {
  if (installed) return;
  installed = true;

  originalError = console.error;
  originalWarn = console.warn;
  console.error = (...args: unknown[]) => {
    originalError?.(...args);
    captureConsole(args);
  };
  console.warn = (...args: unknown[]) => {
    originalWarn?.(...args);
    captureConsole(args);
  };

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
}

export function uninstallClientDiagnostics(): void {
  if (!installed) return;
  installed = false;

  if (originalError) console.error = originalError;
  if (originalWarn) console.warn = originalWarn;
  originalError = undefined;
  originalWarn = undefined;

  window.removeEventListener('error', onWindowError);
  window.removeEventListener('unhandledrejection', onUnhandledRejection);
}
