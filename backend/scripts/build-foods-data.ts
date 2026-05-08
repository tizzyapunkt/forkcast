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
import { FOODS_SEED_KEYS } from './foods-seed-keys.ts';
import { BUILD_FOODS_TOOL, BUILD_FOODS_TOOL_NAME, BUILD_FOODS_SYSTEM_PROMPT } from './build-foods-tool.ts';
import { chunkKeys, collectEntries, sortEntriesById, formatFoodsJson } from './build-foods-helpers.ts';

const BATCH_SIZE = 20;
const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 8192;

async function runBatch(client: Anthropic, ids: ReadonlyArray<string>): Promise<FoodEntry[]> {
  const userMessage = `Submit one food entry per id, in the same order:\n${ids.map((id) => `- ${id}`).join('\n')}`;

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
    throw new Error(`No ${BUILD_FOODS_TOOL_NAME} tool_use block in batch response (ids: ${ids.join(', ')})`);
  }
  const input = toolUse.input as { entries?: unknown };
  if (!Array.isArray(input.entries)) {
    throw new Error(`tool_use input.entries is not an array (ids: ${ids.join(', ')})`);
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

  const batches = chunkKeys(FOODS_SEED_KEYS, BATCH_SIZE);
  const allEntries: FoodEntry[] = [];
  const allErrors: string[] = [];

  console.log(`build-foods-data: processing ${FOODS_SEED_KEYS.length} ids in ${batches.length} batches of ${BATCH_SIZE}`);

  for (const [i, batch] of batches.entries()) {
    console.log(`  batch ${i + 1}/${batches.length} (${batch.length} ids)…`);
    const candidate = await runBatch(client, batch);
    const { entries, errors } = collectEntries(batch, candidate);
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
