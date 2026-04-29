import { describe, it, expect } from 'vitest';
import { fold } from './fold.ts';

describe('fold', () => {
  it('strips umlaut diacritics: Käse → kase', () => {
    expect(fold('Käse')).toBe('kase');
  });

  it('handles uppercase with diacritics: MÖHRE → mohre', () => {
    expect(fold('MÖHRE')).toBe('mohre');
  });

  it('handles ü and ö in mixed case', () => {
    expect(fold('Früchte')).toBe('fruchte');
    expect(fold('Öl')).toBe('ol');
  });

  it('lowercases ASCII without stripping anything', () => {
    expect(fold('Apple')).toBe('apple');
  });

  it('handles empty string', () => {
    expect(fold('')).toBe('');
  });

  it('handles string with no diacritics', () => {
    expect(fold('milch')).toBe('milch');
  });

  it('strips multiple consecutive diacritics in one string', () => {
    expect(fold('Würstchen')).toBe('wurstchen');
  });
});
