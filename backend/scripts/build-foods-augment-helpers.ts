import type { FoodEntry } from '../src/domain/foods/types.ts';
import { fold } from '../src/domain/ingredient-search/fold.ts';

export interface SeedKeyAddition {
  key: string;
  untracked: boolean;
}

export function appendSynonym(entry: FoodEntry, candidate: string): FoodEntry {
  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    throw new Error('cannot append empty synonym');
  }
  const folded = fold(trimmed);
  if (folded === fold(entry.name)) {
    throw new Error(`refusing to add synonym "${trimmed}" that equals the canonical name "${entry.name}"`);
  }
  if (entry.synonyms.some((s) => fold(s) === folded)) {
    return entry;
  }
  return { ...entry, synonyms: [...entry.synonyms, trimmed] };
}

const SEED_ARRAY_OPEN = /export\s+const\s+FOODS_SEED_KEYS\s*:\s*ReadonlyArray<FoodSeedKey>\s*=\s*\[/;

export function appendSeedKey(source: string, additions: ReadonlyArray<SeedKeyAddition>): string {
  if (additions.length === 0) return source;

  const openMatch = SEED_ARRAY_OPEN.exec(source);
  if (!openMatch) {
    throw new Error('could not locate FOODS_SEED_KEYS array literal in seed file');
  }
  const openIndex = openMatch.index;
  const arrayStart = openIndex + openMatch[0].length;
  const closeIndex = findArrayClose(source, arrayStart);
  if (closeIndex === -1) {
    throw new Error('could not parse FOODS_SEED_KEYS array literal: closing bracket not found');
  }

  const existingKeys = collectExistingKeys(source.slice(arrayStart, closeIndex));
  for (const addition of additions) {
    if (existingKeys.has(addition.key)) {
      throw new Error(`seed key "${addition.key}" already exists in FOODS_SEED_KEYS`);
    }
  }

  const insertion = additions
    .map((a) => (a.untracked ? `  { key: '${a.key}', untracked: true },` : `  '${a.key}',`))
    .join('\n');

  const before = source.slice(0, closeIndex);
  const after = source.slice(closeIndex);
  const needsLeadingNewline = !before.endsWith('\n');
  return `${before}${needsLeadingNewline ? '\n' : ''}${insertion}\n${after}`;
}

function findArrayClose(source: string, from: number): number {
  let depth = 1;
  let inString: '\'' | '"' | '`' | null = null;
  for (let i = from; i < source.length; i++) {
    const ch = source[i]!;
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function collectExistingKeys(arrayBody: string): Set<string> {
  const keys = new Set<string>();
  const stringRegex = /'([^']+)'|"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = stringRegex.exec(arrayBody)) !== null) {
    const value = m[1] ?? m[2];
    if (value) keys.add(value);
  }
  return keys;
}
