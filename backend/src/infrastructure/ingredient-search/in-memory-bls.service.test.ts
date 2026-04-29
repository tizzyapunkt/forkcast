import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InMemoryBlsService } from './in-memory-bls.service.ts';
import type { BlsEntry } from '../../domain/bls/types.ts';

const tmpDir = mkdtempSync(join(tmpdir(), 'forkcast-bls-svc-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const KAROTTE: BlsEntry = {
  id: 'G620100',
  name_de: 'Karotte/Möhre, roh',
  name_en: 'Carrot raw',
  calories100: 40,
  protein100: 0.84,
  carbs100: 6.471,
  fat100: 0.4,
};

const KAESE: BlsEntry = {
  id: 'M110200',
  name_de: 'Käse, Camembert',
  name_en: 'Cheese, Camembert',
  calories100: 300,
  protein100: 19,
  carbs100: 1,
  fat100: 24,
};

const CHICKEN: BlsEntry = {
  id: 'F301000',
  name_de: 'Hähnchenbrust, roh',
  name_en: 'Chicken breast, raw',
  calories100: 114,
  protein100: 23,
  carbs100: 0,
  fat100: 2,
};

function makeService(entries: BlsEntry[]): InMemoryBlsService {
  const path = join(tmpDir, `bls-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(entries), 'utf-8');
  return new InMemoryBlsService(path);
}

describe('InMemoryBlsService', () => {
  let svc: InMemoryBlsService;

  beforeEach(async () => {
    svc = makeService([KAROTTE, KAESE, CHICKEN]);
    await svc.init();
  });

  it('finds entries by German name substring (case-insensitive)', async () => {
    const results = await svc.searchByName('karotte');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Karotte/Möhre, roh');
    expect(results[0].source).toBe('BLS');
    expect(results[0].id).toBe('G620100');
  });

  it('matches diacritic-folded query against umlaut names', async () => {
    const results = await svc.searchByName('kase');
    expect(results.some((r) => r.name === 'Käse, Camembert')).toBe(true);
  });

  it('matches uppercase query case-insensitively', async () => {
    const results = await svc.searchByName('MÖHRE');
    expect(results.some((r) => r.id === 'G620100')).toBe(true);
  });

  it('falls back to English name if German name does not match', async () => {
    const results = await svc.searchByName('carrot');
    expect(results.some((r) => r.id === 'G620100')).toBe(true);
  });

  it('returns empty array for query shorter than 2 characters', async () => {
    expect(await svc.searchByName('')).toHaveLength(0);
    expect(await svc.searchByName('k')).toHaveLength(0);
    expect(await svc.searchByName(' ')).toHaveLength(0);
  });

  it('returns empty array when nothing matches', async () => {
    expect(await svc.searchByName('zzznomatch')).toHaveLength(0);
  });

  it('caps results at 20 entries', async () => {
    const entries: BlsEntry[] = Array.from({ length: 30 }, (_, i) => ({
      id: `X${i}`,
      name_de: `Apfelsaft Variante ${i}`,
      name_en: `Apple juice variant ${i}`,
      calories100: 50,
      protein100: 0,
      carbs100: 12,
      fat100: 0,
    }));
    const largeSvc = makeService(entries);
    await largeSvc.init();
    const results = await largeSvc.searchByName('apfelsaft');
    expect(results).toHaveLength(20);
  });

  it('returns null for barcode lookup', async () => {
    expect(await svc.searchByBarcode('1234567890')).toBeNull();
  });

  it('macrosPerUnit are per-gram (divided by 100)', async () => {
    const [result] = await svc.searchByName('karotte');
    expect(result.macrosPerUnit.calories).toBeCloseTo(0.4);
    expect(result.macrosPerUnit.protein).toBeCloseTo(0.0084);
  });
});
