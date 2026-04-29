import { describe, it, expect } from 'vitest';
import { scoreBlsMatch } from './score-bls-match.ts';
import { fold } from './fold.ts';
import type { BlsIndexedEntry } from '../bls/types.ts';

function makeEntry(name_de: string, name_en: string): BlsIndexedEntry {
  return {
    id: 'X',
    name_de,
    name_en,
    calories100: 0,
    protein100: 0,
    carbs100: 0,
    fat100: 0,
    name_de_folded: fold(name_de),
    name_en_folded: fold(name_en),
  };
}

describe('scoreBlsMatch', () => {
  describe('no match', () => {
    it('returns 0 when query appears in neither name', () => {
      const entry = makeEntry('Karotte', 'Carrot');
      expect(scoreBlsMatch(entry, fold('zzznomatch'))).toBe(0);
    });
  });

  describe('German name tier ordering', () => {
    it('ranks exact match (100) above whole-word match (80)', () => {
      const exact = makeEntry('Hähnchenbrust', '');
      const wholeWord = makeEntry('Hähnchenbrust, gegart', '');
      expect(scoreBlsMatch(exact, fold('Hähnchenbrust'))).toBeGreaterThan(
        scoreBlsMatch(wholeWord, fold('Hähnchenbrust')),
      );
    });

    it('ranks whole-word match (80) above prefix match (60)', () => {
      // prefix-only: query is the start but next char is a letter (no boundary)
      const wholeWord = makeEntry('Reis, gekocht', '');
      const prefix = makeEntry('Reisnudeln', '');
      const q = fold('Reis');
      expect(scoreBlsMatch(wholeWord, q)).toBe(80);
      expect(scoreBlsMatch(prefix, q)).toBe(60);
    });

    it('ranks prefix match (60) above token-start match (40)', () => {
      const truePrefix = makeEntry('Reismehl', '');
      const tokenStart = makeEntry('Naturreis (Reisbasis)', '');
      const q = fold('Reis');
      expect(scoreBlsMatch(truePrefix, q)).toBe(60);
      expect(scoreBlsMatch(tokenStart, q)).toBe(40);
    });

    it('ranks token-start match (40) above plain substring (20)', () => {
      const tokenStart = makeEntry('Mit Hähnchenkeule', '');
      const substring = makeEntry('Suppenhähnchen', '');
      const q = fold('Hähnchen');
      expect(scoreBlsMatch(tokenStart, q)).toBe(40);
      expect(scoreBlsMatch(substring, q)).toBe(20);
    });
  });

  describe('English name tier ordering (10 less than German)', () => {
    it('English exact = 90, whole-word = 70, prefix = 50, token-start = 30, substring = 10', () => {
      expect(scoreBlsMatch(makeEntry('', 'Carrot'), fold('Carrot'))).toBe(90);
      expect(scoreBlsMatch(makeEntry('', 'Carrot, raw'), fold('Carrot'))).toBe(70);
      expect(scoreBlsMatch(makeEntry('', 'Carrotcake'), fold('Carrot'))).toBe(50);
      expect(scoreBlsMatch(makeEntry('', 'Big Carrotcake'), fold('Carrot'))).toBe(30);
      expect(scoreBlsMatch(makeEntry('', 'Mycarrotthing'), fold('Carrot'))).toBe(10);
    });
  });

  describe('German vs English precedence', () => {
    it('German tier dominates equal English tier', () => {
      const de = makeEntry('Hähnchen', 'Soup with chicken');
      // DE exact (100) vs EN substring -> 100
      expect(scoreBlsMatch(de, fold('Hähnchen'))).toBe(100);
    });

    it('English exact (90) beats German plain substring (20)', () => {
      const entry = makeEntry('Suppencarrotsalat', 'Carrot');
      expect(scoreBlsMatch(entry, fold('Carrot'))).toBe(90);
    });

    it('returns max of German and English scores', () => {
      const entry = makeEntry('Reis, gekocht', 'Cooked rice');
      // DE whole-word (80) vs EN substring of "rice" not present -> 80
      expect(scoreBlsMatch(entry, fold('Reis'))).toBe(80);
    });
  });

  describe('token boundary characters', () => {
    it.each([
      ['comma', 'Reis, gekocht'],
      ['parenthesis open', 'Topf (Reis innen)'],
      ['parenthesis close', 'Topf(Reis)mit'],
      ['slash', 'Mehl/Reis/Wasser'],
      ['hyphen', 'Mehl-Reis-Mix'],
      ['whitespace', 'Mehl Reis Mix'],
    ])('treats %s as a token boundary (whole-word match = 80)', (_label, name) => {
      const entry = makeEntry(name, '');
      expect(scoreBlsMatch(entry, fold('Reis'))).toBe(80);
    });
  });

  describe('input is already folded', () => {
    it('does not match when query has different case (caller must fold first)', () => {
      // entry's folded names are lowercased; an unfolded query won't match
      const entry = makeEntry('Karotte', 'Carrot');
      expect(scoreBlsMatch(entry, 'KAROTTE')).toBe(0);
      expect(scoreBlsMatch(entry, 'karotte')).toBe(100);
    });
  });
});
