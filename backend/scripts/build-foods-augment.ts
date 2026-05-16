/**
 * Augment `backend/data/foods.json` with entries collected from the unmatched-ingredients store
 * during AI recipe imports. Extends, never overwrites: existing entries are preserved, synonyms
 * may be appended to existing entries, and brand-new entries may be drafted via Anthropic.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... pnpm --filter @forkcast/backend build:foods:augment <path-to-export.json>
 *   ANTHROPIC_API_KEY=sk-... pnpm --filter @forkcast/backend build:foods:augment <path-to-export.json> --dry-run
 *
 * The export file is expected to match the shape of `GET /unmatched-ingredients/export`:
 *   { "entries": [{ "name", "foldedName", "count", "samples": [...], ... }] }
 *
 * The script:
 *   1) Calls Haiku for each unmatched entry to classify it as synonym-of / new-food / skip.
 *   2) Prompts the user per item in the terminal for [a]ccept / [e]dit / [s]kip / [r]ename.
 *   3) For accepted new-food verdicts, calls Opus (same model/tool as `build:foods`) to draft a full entry.
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
import { fold } from '../src/domain/ingredient-search/fold.ts';
import { BUILD_FOODS_TOOL, BUILD_FOODS_TOOL_NAME, BUILD_FOODS_SYSTEM_PROMPT } from './build-foods-tool.ts';
import {
  CLASSIFY_UNMATCHED_TOOL,
  CLASSIFY_UNMATCHED_TOOL_NAME,
  CLASSIFY_UNMATCHED_SYSTEM_PROMPT,
} from './build-foods-classifier-tool.ts';
import { sortEntriesById, formatFoodsJson } from './build-foods-helpers.ts';
import { appendSeedKey, appendSynonym, type SeedKeyAddition } from './build-foods-augment-helpers.ts';

const CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001';
const DRAFT_MODEL = 'claude-opus-4-7';
const MAX_TOKENS_CLASSIFIER = 512;
const MAX_TOKENS_DRAFT = 2048;

interface ExportSample {
  rawName: string;
  rawUnit?: string;
  rawDisplayUnitLabel?: string;
}
interface ExportEntry {
  name: string;
  foldedName: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  samples: ExportSample[];
}
interface ExportPayload {
  entries: ExportEntry[];
}

type Verdict =
  | { kind: 'synonym-of'; existingId: string; confidence: string }
  | { kind: 'new-food'; proposedKey: string; untracked: boolean; confidence: string }
  | { kind: 'skip'; reason: string; confidence: string };

interface AppliedSynonym {
  entryId: string;
  addedSynonym: string;
}
interface AppliedNewFood {
  entry: FoodEntry;
}

async function loadExport(path: string): Promise<ExportPayload> {
  const raw = await readFile(path, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`failed to parse export file as JSON: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { entries?: unknown }).entries)) {
    throw new Error('export file does not match expected shape { entries: [...] }');
  }
  return parsed as ExportPayload;
}

async function loadFoods(path: string): Promise<FoodEntry[]> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as FoodEntry[];
}

async function classifyOne(
  client: Anthropic,
  unmatched: ExportEntry,
  catalogSnippet: string,
): Promise<Verdict> {
  const userMessage = `Catalog:\n${catalogSnippet}\n\nUnmatched ingredient: "${unmatched.name}" (seen ${unmatched.count}x; samples: ${unmatched.samples
    .map(formatSample)
    .join(', ') || 'none'})`;

  const response = await client.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: MAX_TOKENS_CLASSIFIER,
    system: CLASSIFY_UNMATCHED_SYSTEM_PROMPT,
    tools: [CLASSIFY_UNMATCHED_TOOL],
    tool_choice: { type: 'tool', name: CLASSIFY_UNMATCHED_TOOL_NAME },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === CLASSIFY_UNMATCHED_TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error(`Haiku did not return a ${CLASSIFY_UNMATCHED_TOOL_NAME} tool_use block`);
  }
  const input = toolUse.input as Record<string, unknown>;
  const verdict = String(input.verdict ?? '');
  const confidence = String(input.confidence ?? 'medium');
  if (verdict === 'synonym-of') {
    const existingId = String(input.existingId ?? '').trim();
    if (!existingId) throw new Error(`Haiku returned synonym-of without existingId for "${unmatched.name}"`);
    return { kind: 'synonym-of', existingId, confidence };
  }
  if (verdict === 'new-food') {
    const proposedKey = String(input.proposedKey ?? '').trim();
    if (!proposedKey) throw new Error(`Haiku returned new-food without proposedKey for "${unmatched.name}"`);
    return { kind: 'new-food', proposedKey, untracked: false, confidence };
  }
  if (verdict === 'skip') {
    return { kind: 'skip', reason: String(input.reason ?? ''), confidence };
  }
  throw new Error(`Haiku returned unrecognised verdict "${verdict}" for "${unmatched.name}"`);
}

function formatSample(s: ExportSample): string {
  if (s.rawUnit) return `${s.rawName} [${s.rawUnit}]`;
  if (s.rawDisplayUnitLabel) return `${s.rawName} (${s.rawDisplayUnitLabel})`;
  return s.rawName;
}

function buildCatalogSnippet(foods: ReadonlyArray<FoodEntry>): string {
  return foods.map((f) => `- ${f.id}: ${f.name} (synonyms: ${f.synonyms.join(', ') || 'none'})`).join('\n');
}

function formatVerdict(v: Verdict): string {
  if (v.kind === 'synonym-of') return `synonym-of "${v.existingId}" (confidence: ${v.confidence})`;
  if (v.kind === 'new-food')
    return `new-food (proposedKey: "${v.proposedKey}"${v.untracked ? ', untracked' : ''}, confidence: ${v.confidence})`;
  return `skip (${v.reason || 'no reason given'}, confidence: ${v.confidence})`;
}

async function promptForAction(
  rl: ReturnType<typeof createInterface>,
  unmatched: ExportEntry,
  verdict: Verdict,
  position: { i: number; total: number },
  foods: ReadonlyArray<FoodEntry>,
): Promise<{ action: 'accept' | 'skip'; verdict: Verdict }> {
  let current = verdict;
  for (;;) {
    stdout.write(`\n[${position.i}/${position.total}] "${unmatched.name}" (seen ${unmatched.count}x)\n`);
    stdout.write(`  samples: ${unmatched.samples.map(formatSample).join(', ') || 'none'}\n`);
    stdout.write(`  verdict: ${formatVerdict(current)}\n`);
    const answer = (await rl.question('  [a]ccept / [e]dit / [s]kip / [r]ename > ')).trim().toLowerCase();
    if (answer === 'a' || answer === 'accept') {
      return { action: 'accept', verdict: current };
    }
    if (answer === 's' || answer === 'skip') {
      return { action: 'skip', verdict: current };
    }
    if (answer === 'r' || answer === 'rename') {
      current = await renameVerdict(rl, current);
      continue;
    }
    if (answer === 'e' || answer === 'edit') {
      const edited = await editVerdict(rl, current, foods);
      if (edited) current = edited;
      continue;
    }
    stdout.write('  unrecognised — please enter a, e, s, or r.\n');
  }
}

async function editVerdict(
  rl: ReturnType<typeof createInterface>,
  current: Verdict,
  foods: ReadonlyArray<FoodEntry>,
): Promise<Verdict | null> {
  const kind = (await rl.question('  switch to: [1] synonym-of  [2] new-food  [3] skip  [u] toggle untracked > ')).trim();
  if (kind === '1') {
    const existingId = (await rl.question('    existingId > ')).trim();
    if (!existingId) return null;
    if (!foods.some((f) => f.id === existingId)) {
      stdout.write(`    no entry with id "${existingId}" — keeping current verdict.\n`);
      return null;
    }
    return { kind: 'synonym-of', existingId, confidence: 'edited' };
  }
  if (kind === '2') {
    const proposedKey = (await rl.question('    proposedKey > ')).trim();
    if (!proposedKey) return null;
    return { kind: 'new-food', proposedKey, untracked: false, confidence: 'edited' };
  }
  if (kind === '3') {
    const reason = (await rl.question('    reason > ')).trim();
    return { kind: 'skip', reason, confidence: 'edited' };
  }
  if (kind.toLowerCase() === 'u') {
    if (current.kind !== 'new-food') {
      stdout.write('    untracked toggle only applies to new-food verdicts.\n');
      return null;
    }
    return { ...current, untracked: !current.untracked };
  }
  return null;
}

async function renameVerdict(rl: ReturnType<typeof createInterface>, current: Verdict): Promise<Verdict> {
  if (current.kind === 'synonym-of') {
    const existingId = (await rl.question(`    new existingId (was "${current.existingId}") > `)).trim();
    return existingId ? { ...current, existingId } : current;
  }
  if (current.kind === 'new-food') {
    const proposedKey = (await rl.question(`    new proposedKey (was "${current.proposedKey}") > `)).trim();
    return proposedKey ? { ...current, proposedKey } : current;
  }
  return current;
}

async function draftNewFood(
  client: Anthropic,
  proposedKey: string,
  untracked: boolean,
): Promise<FoodEntry> {
  const requestLine = untracked ? `- ${proposedKey} (untracked)` : `- ${proposedKey}`;
  const response = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: MAX_TOKENS_DRAFT,
    system: BUILD_FOODS_SYSTEM_PROMPT,
    tools: [BUILD_FOODS_TOOL],
    tool_choice: { type: 'tool', name: BUILD_FOODS_TOOL_NAME },
    messages: [{ role: 'user', content: `Submit one food entry per id, in the same order:\n${requestLine}` }],
  });
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === BUILD_FOODS_TOOL_NAME,
  );
  if (!toolUse) throw new Error(`Opus did not return a ${BUILD_FOODS_TOOL_NAME} tool_use block for "${proposedKey}"`);
  const entries = (toolUse.input as { entries?: unknown }).entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`Opus draft for "${proposedKey}" returned no entries`);
  }
  const candidate = entries[0] as FoodEntry;
  if (untracked && candidate.untracked !== true) {
    throw new Error(`Opus draft for "${proposedKey}" should be untracked but did not set untracked: true`);
  }
  const result = validateFoodEntry(candidate);
  if (!result.ok) {
    throw new Error(`Opus draft for "${proposedKey}" failed validation: ${result.reason}`);
  }
  return result.entry;
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

interface RunSummary {
  synonyms: AppliedSynonym[];
  newFoods: AppliedNewFood[];
  skipped: ExportEntry[];
  failed: Array<{ entry: ExportEntry; reason: string }>;
}

function printSummary(summary: RunSummary, dryRun: boolean): void {
  stdout.write(`\n${dryRun ? 'DRY RUN ' : ''}Summary:\n`);
  stdout.write(`  Synonyms to add: ${summary.synonyms.length}\n`);
  for (const s of summary.synonyms) stdout.write(`    - "${s.addedSynonym}" → ${s.entryId}\n`);
  stdout.write(`  New foods to add: ${summary.newFoods.length}\n`);
  for (const n of summary.newFoods) stdout.write(`    - ${n.entry.id} (${n.entry.name})\n`);
  stdout.write(`  Skipped: ${summary.skipped.length}\n`);
  if (summary.failed.length > 0) {
    stdout.write(`  Failed: ${summary.failed.length}\n`);
    for (const f of summary.failed) stdout.write(`    - "${f.entry.name}": ${f.reason}\n`);
  }
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

  const [exportPayload, foods, seedSource] = await Promise.all([
    loadExport(exportPath),
    loadFoods(foodsPath),
    readFile(seedPath, 'utf-8'),
  ]);

  if (exportPayload.entries.length === 0) {
    stdout.write('No unmatched ingredients to process. Nothing to do.\n');
    return;
  }

  const client = new Anthropic({ apiKey });
  const catalogSnippet = buildCatalogSnippet(foods);

  const workingFoods: FoodEntry[] = [...foods];
  const summary: RunSummary = { synonyms: [], newFoods: [], skipped: [], failed: [] };

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    for (let i = 0; i < exportPayload.entries.length; i++) {
      const entry = exportPayload.entries[i]!;
      let verdict: Verdict;
      try {
        verdict = await classifyOne(client, entry, catalogSnippet);
      } catch (err) {
        const reason = (err as Error).message;
        summary.failed.push({ entry, reason });
        stdout.write(`\n[${i + 1}/${exportPayload.entries.length}] "${entry.name}" — Haiku failed: ${reason}\n`);
        continue;
      }

      const { action, verdict: finalVerdict } = await promptForAction(
        rl,
        entry,
        verdict,
        { i: i + 1, total: exportPayload.entries.length },
        workingFoods,
      );

      if (action === 'skip' || finalVerdict.kind === 'skip') {
        summary.skipped.push(entry);
        continue;
      }

      try {
        if (finalVerdict.kind === 'synonym-of') {
          const targetIdx = workingFoods.findIndex((f) => f.id === finalVerdict.existingId);
          if (targetIdx === -1) {
            throw new Error(`no entry with id "${finalVerdict.existingId}"`);
          }
          const before = workingFoods[targetIdx]!;
          const updated = appendSynonym(before, entry.name);
          if (updated !== before) {
            workingFoods[targetIdx] = updated;
            summary.synonyms.push({ entryId: before.id, addedSynonym: entry.name });
          } else {
            stdout.write(`  (no-op: "${entry.name}" already a synonym of ${before.id})\n`);
          }
        } else if (finalVerdict.kind === 'new-food') {
          if (workingFoods.some((f) => f.id === finalVerdict.proposedKey)) {
            throw new Error(`entry with id "${finalVerdict.proposedKey}" already exists`);
          }
          stdout.write(`  drafting nutrition via Opus for "${finalVerdict.proposedKey}"…\n`);
          const drafted = await draftNewFood(client, finalVerdict.proposedKey, finalVerdict.untracked);
          if (drafted.id !== finalVerdict.proposedKey) {
            throw new Error(`Opus drafted id "${drafted.id}" but we asked for "${finalVerdict.proposedKey}"`);
          }
          workingFoods.push(drafted);
          // Make sure the synonym entry.name is also captured if it differs from canonical
          if (fold(entry.name) !== fold(drafted.name)) {
            const withSynonym = appendSynonym(drafted, entry.name);
            workingFoods[workingFoods.length - 1] = withSynonym;
          }
          summary.newFoods.push({ entry: workingFoods[workingFoods.length - 1]! });
        }
      } catch (err) {
        summary.failed.push({ entry, reason: (err as Error).message });
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

  // Build the seed-key additions (only for new foods).
  const seedAdditions: SeedKeyAddition[] = summary.newFoods.map((n) => ({
    key: n.entry.id,
    untracked: n.entry.untracked === true,
  }));

  // Validate the seed file can accept the additions before touching foods.json.
  if (seedAdditions.length > 0) {
    try {
      appendSeedKey(seedSource, seedAdditions);
    } catch (err) {
      stdout.write(`\nRefusing to write — seed file rejected the new keys: ${(err as Error).message}\n`);
      stdout.write(`Add the following entries to backend/scripts/foods-seed-keys.ts manually:\n`);
      for (const a of seedAdditions) {
        stdout.write(`  ${a.untracked ? `{ key: '${a.key}', untracked: true },` : `'${a.key}',`}\n`);
      }
      process.exit(1);
    }
  }

  await writeFoodsAtomic(foodsPath, workingFoods);
  if (seedAdditions.length > 0) {
    await writeSeedFileAtomic(seedPath, seedSource, seedAdditions);
  }
  stdout.write(`\nWrote ${foodsPath}\n`);
  if (seedAdditions.length > 0) stdout.write(`Wrote ${seedPath}\n`);
}

await main();
