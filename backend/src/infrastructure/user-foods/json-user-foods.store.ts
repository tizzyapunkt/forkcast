import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FoodEntry } from '../../domain/foods/types.ts';
import type { LearnedSynonym, UserFoodsOverlay, UserFoodsStore } from '../../domain/user-foods/types.ts';
import { addFoodToOverlay, addSynonymToOverlay, emptyOverlay } from '../../domain/user-foods/overlay-ops.ts';
import { validateFoodEntry } from '../../domain/foods/validate-food-entry.ts';

/**
 * Runtime-writable JSON store for the user-foods overlay. Mirrors the other
 * JSON-store adapters: serialised writes, atomic rename, validate-and-skip on
 * load. Missing or malformed files are treated as an empty overlay.
 */
export class JsonUserFoodsStore implements UserFoodsStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async load(): Promise<UserFoodsOverlay> {
    if (!existsSync(this.filePath)) return emptyOverlay();
    const raw = await readFile(this.filePath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`user-foods: failed to parse ${this.filePath}; treating as empty`);
      return emptyOverlay();
    }
    if (!parsed || typeof parsed !== 'object') {
      console.warn(`user-foods: malformed top-level shape in ${this.filePath}; treating as empty`);
      return emptyOverlay();
    }
    const obj = parsed as { foods?: unknown; synonyms?: unknown };
    const foods: FoodEntry[] = [];
    if (Array.isArray(obj.foods)) {
      for (const entry of obj.foods) {
        const result = validateFoodEntry(entry as FoodEntry);
        if (!result.ok) {
          console.warn(`user-foods: skipping invalid food entry: ${result.reason}`);
          continue;
        }
        foods.push(result.entry);
      }
    }
    const synonyms: LearnedSynonym[] = [];
    if (Array.isArray(obj.synonyms)) {
      for (const s of obj.synonyms) {
        if (s && typeof s === 'object' && typeof s.foodId === 'string' && typeof s.synonym === 'string') {
          synonyms.push({ foodId: s.foodId, synonym: s.synonym });
        }
      }
    }
    return { foods, synonyms };
  }

  async addFood(entry: FoodEntry): Promise<void> {
    await this.enqueue(async () => {
      const current = await this.load();
      const result = addFoodToOverlay(current, entry);
      if (!result.ok) throw new Error(`user-foods: cannot add "${entry.name}": ${result.reason}`);
      await this.writeAtomic(result.overlay);
    });
  }

  async addSynonym(syn: LearnedSynonym): Promise<void> {
    await this.enqueue(async () => {
      const current = await this.load();
      await this.writeAtomic(addSynonymToOverlay(current, syn));
    });
  }

  async exportAndClear(): Promise<UserFoodsOverlay> {
    return this.enqueue(async () => {
      const current = await this.load();
      await this.writeAtomic(emptyOverlay());
      return current;
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async writeAtomic(overlay: UserFoodsOverlay): Promise<void> {
    const sortedFoods = [...overlay.foods].sort((a, b) => a.id.localeCompare(b.id));
    const sortedSynonyms = [...overlay.synonyms].sort(
      (a, b) => a.foodId.localeCompare(b.foodId) || a.synonym.localeCompare(b.synonym),
    );
    const payload = { foods: sortedFoods, synonyms: sortedSynonyms };
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
    await rename(tmpPath, this.filePath);
  }
}
