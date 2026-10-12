/**
 * One stored JSON document, as text. Adapters keep their own parsing and
 * formatting; this port only decides where the text lives (a file on disk, a
 * browser store, memory in tests).
 */
export interface JsonDocument {
  /** Where the document lives, for log and error messages (a file path, a store key). */
  readonly location: string;
  /** The stored text, or null when nothing is stored. */
  read(): Promise<string | null>;
  /** Replace the stored text. Durable once the promise resolves; never leaves a half-written document. */
  write(text: string): Promise<void>;
}
