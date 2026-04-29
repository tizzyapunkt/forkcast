import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBlsCsv } from '../src/domain/bls/parse-bls-csv.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(dir, '../../BLS_4_0_Daten_2025_DE.csv');
const outPath = resolve(dir, '../data/bls.json');

const csv = readFileSync(csvPath, 'utf-8');
const rows = parseBlsCsv(csv);
writeFileSync(outPath, JSON.stringify(rows) + '\n', 'utf-8');
console.log(`bls.json: ${rows.length} rows written to ${outPath}`);
