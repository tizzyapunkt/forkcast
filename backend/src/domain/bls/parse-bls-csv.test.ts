import { describe, it, expect } from 'vitest';
import { parseBlsCsv } from './parse-bls-csv.ts';

const HEADER =
  'BLS Code;Lebensmittelbezeichnung;Food name;ENERCJ Energie (Kilojoule) [kJ/100g];ENERCJ Datenherkunft;ENERCJ Referenz;ENERCC Energie (Kilokalorien) [kcal/100g];ENERCC Datenherkunft;ENERCC Referenz;WATER Wasser [g/100g];WATER Datenherkunft;WATER Referenz;PROT625 Protein (Nx6,25) [g/100g];PROT625 Datenherkunft;PROT625 Referenz;FAT Fett [g/100g];FAT Datenherkunft;FAT Referenz;CHO Kohlenhydrate, verfügbar [g/100g]';

function makeCsv(rows: string[]): string {
  return [HEADER, ...rows].join('\r\n') + '\r\n';
}

describe('parseBlsCsv', () => {
  it('parses a simple valid row', () => {
    const csv = makeCsv(['A001;Karotte;Carrot;;; ;250;calc;ref;88;calc;ref;1,2;calc;ref;0,3;calc;ref;9,5']);
    const rows = parseBlsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: 'A001',
      name_de: 'Karotte',
      name_en: 'Carrot',
      calories100: 250,
      protein100: 1.2,
      fat100: 0.3,
      carbs100: 9.5,
    });
  });

  it('strips the UTF-8 BOM from the start', () => {
    const csv = '﻿' + makeCsv(['A001;Karotte;Carrot;;;; 250;calc;ref;88;calc;ref;1,2;calc;ref;0,3;calc;ref;9,5']);
    const rows = parseBlsCsv(csv);
    expect(rows).toHaveLength(1);
  });

  it('converts German decimal commas to dots', () => {
    const csv = makeCsv(['A002;Hähnchen;Chicken;;;; 165;calc;ref;65;calc;ref;31,5;calc;ref;3,6;calc;ref;0,0']);
    const rows = parseBlsCsv(csv);
    expect(rows[0].protein100).toBeCloseTo(31.5);
    expect(rows[0].fat100).toBeCloseTo(3.6);
  });

  it('excludes rows where kcal is missing', () => {
    const csv = makeCsv([
      'A001;Karotte;Carrot;;;; 250;calc;ref;88;calc;ref;1,2;calc;ref;0,3;calc;ref;9,5',
      'A002;Mystery;;;;;;calc;ref;88;calc;ref;1,2;calc;ref;0,3;calc;ref;0,0',
    ]);
    const rows = parseBlsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('A001');
  });

  it('excludes rows where kcal is unparseable', () => {
    const csv = makeCsv(['A999;Bad;Bad;;;; N/A;calc;ref;0;calc;ref;0;calc;ref;0;calc;ref;0']);
    expect(parseBlsCsv(csv)).toHaveLength(0);
  });

  it('rounds macros to 3 decimal places', () => {
    const csv = makeCsv(['B001;Test;Test;;;; 100;calc;ref;0;calc;ref;1,2345;calc;ref;0;calc;ref;0']);
    const rows = parseBlsCsv(csv);
    expect(rows[0].protein100).toBe(1.235);
  });

  it('handles quoted fields with embedded semicolons (RFC 4180)', () => {
    // Referenz fields in the real BLS CSV contain quotes with embedded semicolons.
    // Placing the quoted field at col 5 (ENERCJ Referenz) so kcal stays at col 6.
    const csv = makeCsv([
      'A001;Karotte;Carrot;;;"Smith; Jones 2005";250;calc;ref;88;calc;ref;1,2;calc;ref;0,3;calc;ref;9,5',
    ]);
    const rows = parseBlsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('A001');
    expect(rows[0].calories100).toBe(250);
    expect(rows[0].protein100).toBe(1.2);
  });

  it('skips blank lines', () => {
    const csv =
      HEADER + '\r\n' + 'A001;Karotte;Carrot;;;; 250;calc;ref;88;calc;ref;1,2;calc;ref;0,3;calc;ref;9,5\r\n\r\n';
    expect(parseBlsCsv(csv)).toHaveLength(1);
  });

  it('returns empty array for empty CSV', () => {
    expect(parseBlsCsv('')).toHaveLength(0);
    expect(parseBlsCsv(HEADER + '\r\n')).toHaveLength(0);
  });
});
