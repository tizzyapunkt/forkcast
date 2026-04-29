export interface BlsCsvRow {
  id: string;
  name_de: string;
  name_en: string;
  calories100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
}

function parseGermanFloat(s: string): number | null {
  const normalized = s.trim().replace(',', '.');
  if (normalized === '') return null;
  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ';' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function parseBlsCsv(csv: string): BlsCsvRow[] {
  const content = csv.startsWith('﻿') ? csv.slice(1) : csv;
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);
  const col = (label: string): number => {
    const i = headers.indexOf(label);
    if (i === -1) throw new Error(`Column not found in BLS CSV: "${label}"`);
    return i;
  };

  const idIdx = col('BLS Code');
  const deIdx = col('Lebensmittelbezeichnung');
  const enIdx = col('Food name');
  const kcalIdx = col('ENERCC Energie (Kilokalorien) [kcal/100g]');
  const protIdx = col('PROT625 Protein (Nx6,25) [g/100g]');
  const fatIdx = col('FAT Fett [g/100g]');
  const choIdx = col('CHO Kohlenhydrate, verfügbar [g/100g]');

  const rows: BlsCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = parseLine(line);
    const calories100 = parseGermanFloat(cells[kcalIdx] ?? '');
    if (calories100 === null) continue;

    rows.push({
      id: cells[idIdx]?.trim() ?? '',
      name_de: cells[deIdx]?.trim() ?? '',
      name_en: cells[enIdx]?.trim() ?? '',
      calories100: round3(calories100),
      protein100: round3(parseGermanFloat(cells[protIdx] ?? '') ?? 0),
      fat100: round3(parseGermanFloat(cells[fatIdx] ?? '') ?? 0),
      carbs100: round3(parseGermanFloat(cells[choIdx] ?? '') ?? 0),
    });
  }
  return rows;
}
