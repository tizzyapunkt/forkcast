export type DiagnosticsKind = 'http' | 'error' | 'off';

export interface DiagnosticsEntry {
  at: string;
  kind: DiagnosticsKind;
  message: string;
  detail?: string;
}

export interface DiagnosticsRecorder {
  record(entry: { kind: DiagnosticsKind; message: string; detail?: string }): void;
}

const DEFAULT_CAPACITY = 500;

export class DiagnosticsLog implements DiagnosticsRecorder {
  private entries: DiagnosticsEntry[] = [];

  constructor(private readonly capacity: number = DEFAULT_CAPACITY) {}

  record(entry: { kind: DiagnosticsKind; message: string; detail?: string }): void {
    this.entries.push({ at: new Date().toISOString(), ...entry });
    if (this.entries.length > this.capacity) this.entries.splice(0, this.entries.length - this.capacity);
  }

  recent(): DiagnosticsEntry[] {
    return [...this.entries];
  }
}
