/**
 * Regenerate `backend/data/foods.json` from the curated key list (`foods-seed-keys.ts`).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... pnpm --filter @forkcast/backend build:foods
 *
 * Re-running this script overwrites `data/foods.json`. Hand edits to that file
 * are not preserved across re-runs — to make a correction stick, edit the file
 * after the script runs and commit the diff. The committed JSON is the source
 * of truth; the script is a tool to seed and refresh it.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import type { FoodEntry } from '../src/domain/foods/types.ts';
import { FOODS_SEED_KEYS, normalizeFoodSeedKeys, type NormalizedFoodSeedKey } from './foods-seed-keys.ts';
import {
  BUILD_FOODS_TOOL,
  BUILD_FOODS_TOOL_NAME,
  BUILD_FOODS_SYSTEM_PROMPT,
} from '../src/infrastructure/food-resolution/build-foods-tool.ts';
import { chunkKeys, collectEntries, sortEntriesById, formatFoodsJson } from './build-foods-helpers.ts';

const BATCH_SIZE = 20;
const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 8192;

function formatRequestLine(entry: NormalizedFoodSeedKey): string {
  return entry.untracked ? `- ${entry.key} (untracked)` : `- ${entry.key}`;
}

async function runBatch(client: Anthropic, batch: ReadonlyArray<NormalizedFoodSeedKey>): Promise<FoodEntry[]> {
  const userMessage = `Submit one food entry per id, in the same order:\n${batch.map(formatRequestLine).join('\n')}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: BUILD_FOODS_SYSTEM_PROMPT,
    tools: [BUILD_FOODS_TOOL],
    tool_choice: { type: 'tool', name: BUILD_FOODS_TOOL_NAME },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === BUILD_FOODS_TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error(
      `No ${BUILD_FOODS_TOOL_NAME} tool_use block in batch response (ids: ${batch.map((b) => b.key).join(', ')})`,
    );
  }
  const input = toolUse.input as { entries?: unknown };
  if (!Array.isArray(input.entries)) {
    throw new Error(`tool_use input.entries is not an array (ids: ${batch.map((b) => b.key).join(', ')})`);
  }
  return input.entries as FoodEntry[];
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  const normalizedSeed = normalizeFoodSeedKeys(FOODS_SEED_KEYS);
  const allKeys = normalizedSeed.map((s) => s.key);
  const untrackedKeys = new Set(normalizedSeed.filter((s) => s.untracked).map((s) => s.key));

  const keyBatches = chunkKeys(allKeys, BATCH_SIZE);
  const seedBatches: NormalizedFoodSeedKey[][] = keyBatches.map((batch) =>
    batch.map((key) => ({ key, untracked: untrackedKeys.has(key) })),
  );

  const allEntries: FoodEntry[] = [];
  const allErrors: string[] = [];

  console.log(
    `build-foods-data: processing ${normalizedSeed.length} ids (${untrackedKeys.size} untracked) in ${keyBatches.length} batches of ${BATCH_SIZE}`,
  );

  for (const [i, seedBatch] of seedBatches.entries()) {
    const keyBatch = seedBatch.map((s) => s.key);
    console.log(`  batch ${i + 1}/${seedBatches.length} (${seedBatch.length} ids)…`);
    const candidate = await runBatch(client, seedBatch);
    const { entries, errors } = collectEntries(keyBatch, candidate, { untrackedKeys });
    allEntries.push(...entries);
    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    console.error(`build-foods-data: ${allErrors.length} error(s):`);
    for (const err of allErrors) console.error(`  - ${err}`);
    process.exit(1);
  }

  const sorted = sortEntriesById(allEntries);
  const dir = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(dir, '../data/foods.json');
  writeFileSync(outPath, formatFoodsJson(sorted), 'utf-8');
  console.log(`build-foods-data: wrote ${sorted.length} entries to ${outPath}`);
}

await main();
