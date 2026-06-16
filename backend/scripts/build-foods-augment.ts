/**
 * Promote a user-foods overlay export into the curated catalog. Extends, never
 * overwrites: existing entries are preserved, learned synonyms are appended to
 * their curated entries, and confirmed new foods are re-drafted via Anthropic
 * (using the confirmed entry as a hint) so the curated artifact stays uniform.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... pnpm --filter @forkcast/backend build:foods:augment <path-to-export.json>
 *   ANTHROPIC_API_KEY=sk-... pnpm --filter @forkcast/backend build:foods:augment <path-to-export.json> --dry-run
 *
 * The export file is the body of `POST /export-user-foods`:
 *   { "foods": [<FoodEntry>...], "synonyms": [{ "foodId", "synonym" }...] }
 *
 * The script:
 *   1) Applies learned synonyms to their curated entries (orphaned ids are surfaced and skipped).
 *   2) Prompts the user per confirmed food for [a]ccept / [e]dit / [s]kip (accept is the default).
 *   3) For accepted foods, calls Opus (shared build-foods tool) with the confirmed entry as a hint.
 *   4) Writes the updated foods.json and foods-seed-keys.ts atomically (skipped under --dry-run).
 */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import Anthropic from '@anthropic-ai/sdk';
import type { FoodEntry } from '../src/domain/foods/types.ts';
import { validateFoodEntry } from '../src/domain/foods/validate-food-entry.ts';
import {
  BUILD_FOODS_TOOL,
  BUILD_FOODS_TOOL_NAME,
  BUILD_FOODS_SYSTEM_PROMPT,
} from '../src/infrastructure/food-resolution/build-foods-tool.ts';
import { sortEntriesById, formatFoodsJson } from './build-foods-helpers.ts';
import { appendSeedKey, type SeedKeyAddition } from './build-foods-augment-helpers.ts';
import {
  parseOverlayExport,
  applySynonyms,
  draftHintMessage,
  type OverlayExport,
} from './build-foods-augment-overlay.ts';

const DRAFT_MODEL = 'claude-opus-4-7';
const MAX_TOKENS_DRAFT = 2048;

async function loadOverlayExport(path: string): Promise<OverlayExport> {
  const raw = await readFile(path, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`failed to parse export file as JSON: ${(err as Error).message}`);
  }
  return parseOverlayExport(parsed);
}

async function loadFoods(path: string): Promise<FoodEntry[]> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as FoodEntry[];
}

async function draftFromHint(client: Anthropic, entry: FoodEntry): Promise<FoodEntry> {
  const response = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: MAX_TOKENS_DRAFT,
    system: BUILD_FOODS_SYSTEM_PROMPT,
    tools: [BUILD_FOODS_TOOL],
    tool_choice: { type: 'tool', name: BUILD_FOODS_TOOL_NAME },
    messages: [{ role: 'user', content: draftHintMessage(entry) }],
  });
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === BUILD_FOODS_TOOL_NAME,
  );
  if (!toolUse) throw new Error(`Opus did not return a ${BUILD_FOODS_TOOL_NAME} tool_use block for "${entry.id}"`);
  const entries = (toolUse.input as { entries?: unknown }).entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`Opus draft for "${entry.id}" returned no entries`);
  }
  const candidate = entries[0] as FoodEntry;
  if (entry.untracked === true && candidate.untracked !== true) {
    throw new Error(`Opus draft for "${entry.id}" should be untracked but did not set untracked: true`);
  }
  const result = validateFoodEntry(candidate);
  if (!result.ok) throw new Error(`Opus draft for "${entry.id}" failed validation: ${result.reason}`);
  return result.entry;
}

async function promptForAction(
  rl: ReturnType<typeof createInterface>,
  entry: FoodEntry,
  position: { i: number; total: number },
): Promise<'accept' | 'skip'> {
  for (;;) {
    stdout.write(`\n[${position.i}/${position.total}] confirmed food "${entry.name}" (id: ${entry.id})\n`);
    stdout.write(
      `  unit: ${entry.unit} · per 100: ${entry.macrosPer100.calories} kcal / ${entry.macrosPer100.protein}P / ${entry.macrosPer100.carbs}KH / ${entry.macrosPer100.fat}F${entry.untracked ? ' · untracked' : ''}\n`,
    );
    const answer = (await rl.question('  [a]ccept (default) / [e]dit / [s]kip > ')).trim().toLowerCase();
    if (answer === '' || answer === 'a' || answer === 'accept') return 'accept';
    if (answer === 's' || answer === 'skip') return 'skip';
    if (answer === 'e' || answer === 'edit') {
      stdout.write('  edit the values in the export file and re-run; skipping for now.\n');
      return 'skip';
    }
    stdout.write('  unrecognised — press enter to accept, or type s to skip.\n');
  }
}

interface RunSummary {
  synonyms: Array<{ foodId: string; synonym: string }>;
  orphanedSynonyms: Array<{ foodId: string; synonym: string }>;
  newFoods: FoodEntry[];
  skipped: string[];
  failed: Array<{ id: string; reason: string }>;
}

function printSummary(summary: RunSummary, dryRun: boolean): void {
  stdout.write(`\n${dryRun ? 'DRY RUN ' : ''}Summary:\n`);
  stdout.write(`  Synonyms applied: ${summary.synonyms.length}\n`);
  for (const s of summary.synonyms) stdout.write(`    - "${s.synonym}" → ${s.foodId}\n`);
  if (summary.orphanedSynonyms.length > 0) {
    stdout.write(`  Orphaned synonyms (no such curated id — handle manually): ${summary.orphanedSynonyms.length}\n`);
    for (const s of summary.orphanedSynonyms) stdout.write(`    - "${s.synonym}" → ${s.foodId} (missing)\n`);
  }
  stdout.write(`  New foods to add: ${summary.newFoods.length}\n`);
  for (const n of summary.newFoods) stdout.write(`    - ${n.id} (${n.name})\n`);
  stdout.write(`  Skipped: ${summary.skipped.length}\n`);
  if (summary.failed.length > 0) {
    stdout.write(`  Failed: ${summary.failed.length}\n`);
    for (const f of summary.failed) stdout.write(`    - ${f.id}: ${f.reason}\n`);
  }
}

async function writeFoodsAtomic(filePath: string, entries: FoodEntry[]): Promise<void> {
  const sorted = sortEntriesById(entries);
  for (const e of sorted) {
    const v = validateFoodEntry(e);
    if (!v.ok) throw new Error(`refusing to write — entry ${e.id} failed validation: ${v.reason}`);
  }
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, formatFoodsJson(sorted), 'utf-8');
  await rename(tmp, filePath);
}

async function writeSeedFileAtomic(filePath: string, source: string, additions: SeedKeyAddition[]): Promise<void> {
  const next = appendSeedKey(source, additions);
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, next, 'utf-8');
  await rename(tmp, filePath);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const positional = args.filter((a) => !a.startsWith('--'));
  if (positional.length === 0) {
    console.error('usage: build:foods:augment <path-to-export.json> [--dry-run]');
    process.exit(1);
  }
  const exportPath = resolve(positional[0]!);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const foodsPath = resolve(scriptDir, '../data/foods.json');
  const seedPath = resolve(scriptDir, 'foods-seed-keys.ts');

  let overlay: OverlayExport;
  try {
    overlay = await loadOverlayExport(exportPath);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const [foods, seedSource] = await Promise.all([loadFoods(foodsPath), readFile(seedPath, 'utf-8')]);

  if (overlay.foods.length === 0 && overlay.synonyms.length === 0) {
    stdout.write('Overlay export is empty. Nothing to do.\n');
    return;
  }

  // 1) Synonyms first — pure, no AI.
  const synResult = applySynonyms(foods, overlay.synonyms);
  const workingFoods: FoodEntry[] = [...synResult.foods];
  const summary: RunSummary = {
    synonyms: synResult.applied,
    orphanedSynonyms: synResult.orphaned,
    newFoods: [],
    skipped: [],
    failed: [],
  };

  // 2) Confirmed foods — human-in-the-loop, then Opus draft on accept.
  const client = new Anthropic({ apiKey });
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    for (let i = 0; i < overlay.foods.length; i++) {
      const entry = overlay.foods[i]!;
      if (workingFoods.some((f) => f.id === entry.id)) {
        summary.failed.push({ id: entry.id, reason: 'a curated entry with this id already exists' });
        continue;
      }
      const action = await promptForAction(rl, entry, { i: i + 1, total: overlay.foods.length });
      if (action === 'skip') {
        summary.skipped.push(entry.id);
        continue;
      }
      try {
        stdout.write(`  drafting via Opus for "${entry.id}"…\n`);
        const drafted = dryRun ? entry : await draftFromHint(client, entry);
        workingFoods.push(drafted);
        summary.newFoods.push(drafted);
      } catch (err) {
        summary.failed.push({ id: entry.id, reason: (err as Error).message });
        stdout.write(`  failed: ${(err as Error).message}\n`);
      }
    }
  } finally {
    rl.close();
  }

  printSummary(summary, dryRun);

  if (summary.failed.length > 0) {
    stdout.write('\nRefusing to write because of failures above.\n');
    process.exit(1);
  }
  if (summary.synonyms.length === 0 && summary.newFoods.length === 0) {
    stdout.write('\nNothing to write.\n');
    return;
  }
  if (dryRun) {
    stdout.write('\nDry run — no files written.\n');
    return;
  }

  const seedAdditions: SeedKeyAddition[] = summary.newFoods.map((n) => ({
    key: n.id,
    untracked: n.untracked === true,
  }));
  if (seedAdditions.length > 0) {
    try {
      appendSeedKey(seedSource, seedAdditions);
    } catch (err) {
      stdout.write(`\nRefusing to write — seed file rejected the new keys: ${(err as Error).message}\n`);
      stdout.write('Add the following entries to backend/scripts/foods-seed-keys.ts manually:\n');
      for (const a of seedAdditions) {
        stdout.write(`  ${a.untracked ? `{ key: '${a.key}', untracked: true },` : `'${a.key}',`}\n`);
      }
      process.exit(1);
    }
  }

  await writeFoodsAtomic(foodsPath, workingFoods);
  if (seedAdditions.length > 0) await writeSeedFileAtomic(seedPath, seedSource, seedAdditions);
  stdout.write(`\nWrote ${foodsPath}\n`);
  if (seedAdditions.length > 0) stdout.write(`Wrote ${seedPath}\n`);
}

await main();
