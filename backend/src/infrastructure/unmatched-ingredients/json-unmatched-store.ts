import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RawIngredient } from '../../domain/ai-recipe-import/types.ts';
import { recordUnmatched } from '../../domain/unmatched-ingredients/record-unmatched.ts';
import type {
  UnmatchedIngredientEntry,
  UnmatchedIngredientRecorder,
  UnmatchedIngredientStore,
} from '../../domain/unmatched-ingredients/types.ts';

export class JsonUnmatchedIngredientStore implements UnmatchedIngredientRecorder {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async load(): Promise<UnmatchedIngredientStore> {
    if (!existsSync(this.filePath)) return { entries: [] };
    const raw = await readFile(this.filePath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`unmatched-ingredients: failed to parse ${this.filePath}; treating as empty`);
      return { entries: [] };
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { entries?: unknown }).entries)) {
      console.warn(`unmatched-ingredients: malformed top-level shape in ${this.filePath}; treating as empty`);
      return { entries: [] };
    }
    const entries = (parsed as { entries: unknown[] }).entries
      .map((e) => validateEntry(e))
      .filter((e): e is UnmatchedIngredientEntry => e !== null);
    return { entries };
  }

  async record(raw: RawIngredient): Promise<void> {
    await this.enqueue(async () => {
      const current = await this.load();
      const next = recordUnmatched(current, raw, new Date());
      await this.writeAtomic(next);
    });
  }

  async clear(): Promise<void> {
    await this.enqueue(async () => {
      await this.writeAtomic({ entries: [] });
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async writeAtomic(store: UnmatchedIngredientStore): Promise<void> {
    const sorted: UnmatchedIngredientStore = {
      entries: [...store.entries].sort((a, b) => a.foldedName.localeCompare(b.foldedName)),
    };
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
    await rename(tmpPath, this.filePath);
  }
}

function validateEntry(value: unknown): UnmatchedIngredientEntry | null {
  if (!value || typeof value !== 'object') {
    console.warn('unmatched-ingredients: dropping non-object entry');
    return null;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string') {
    console.warn(`unmatched-ingredients: dropping entry with non-string name (${String(v.name)})`);
    return null;
  }
  if (typeof v.foldedName !== 'string') {
    console.warn(`unmatched-ingredients: dropping entry "${v.name}" with non-string foldedName`);
    return null;
  }
  if (typeof v.count !== 'number' || !Number.isFinite(v.count)) {
    console.warn(`unmatched-ingredients: dropping entry "${v.name}" with non-finite count`);
    return null;
  }
  if (typeof v.firstSeenAt !== 'string' || typeof v.lastSeenAt !== 'string') {
    console.warn(`unmatched-ingredients: dropping entry "${v.name}" with non-string timestamps`);
    return null;
  }
  if (!Array.isArray(v.samples)) {
    console.warn(`unmatched-ingredients: dropping entry "${v.name}" with non-array samples`);
    return null;
  }
  return {
    name: v.name,
    foldedName: v.foldedName,
    count: v.count,
    firstSeenAt: v.firstSeenAt,
    lastSeenAt: v.lastSeenAt,
    samples: v.samples as UnmatchedIngredientEntry['samples'],
  };
}
