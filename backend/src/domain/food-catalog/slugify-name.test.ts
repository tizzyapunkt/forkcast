import { describe, it, expect } from 'vitest';
import { slugifyName } from './slugify-name.ts';

describe('slugifyName', () => {
  it('romanises German umlauts rather than stripping them', () => {
    expect(slugifyName('Möhre')).toBe('moehre');
    expect(slugifyName('Hähnchenbrust')).toBe('haehnchenbrust');
    expect(slugifyName('Müsli')).toBe('muesli');
    expect(slugifyName('Weißkohl')).toBe('weisskohl');
  });

  it('joins words with single hyphens', () => {
    expect(slugifyName('Getrocknete Tomaten in Öl')).toBe('getrocknete-tomaten-in-oel');
    expect(slugifyName('Weizenmehl 405')).toBe('weizenmehl-405');
  });

  it('strips remaining diacritics and punctuation', () => {
    expect(slugifyName('Crème fraîche')).toBe('creme-fraiche');
    expect(slugifyName('Joghurt, 3,5 %')).toBe('joghurt-3-5');
    expect(slugifyName('Balsamico-Essig')).toBe('balsamico-essig');
  });

  it('collapses separators and trims them from both ends', () => {
    expect(slugifyName('  Salz   und  Pfeffer  ')).toBe('salz-und-pfeffer');
    expect(slugifyName('(Bio) Tofu!')).toBe('bio-tofu');
  });

  it('returns an empty string when nothing sluggable remains', () => {
    expect(slugifyName('   ')).toBe('');
    expect(slugifyName('!!!')).toBe('');
  });
});
