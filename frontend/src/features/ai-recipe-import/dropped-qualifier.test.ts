import { describe, it, expect } from 'vitest';
import { droppedQualifier } from './dropped-qualifier';

describe('droppedQualifier', () => {
  it('returns the words the rename dropped from the raw name', () => {
    expect(droppedQualifier('dünne Reisnudeln', 'Reisnudeln')).toBe('dünne');
  });

  it('returns nothing when the name was not narrowed', () => {
    expect(droppedQualifier('Reisnudeln', 'Reisnudeln')).toBe('');
  });

  it('ignores case and diacritics when deciding what survived', () => {
    expect(droppedQualifier('Dünne REISNUDELN', 'Reisnudeln')).toBe('Dünne');
  });

  it('preserves the raw spelling of the dropped words', () => {
    expect(droppedQualifier('Dünne Reisnudeln', 'reisnudeln')).toBe('Dünne');
  });

  it('joins multiple dropped words in raw order', () => {
    expect(droppedQualifier('sehr dünne rote Reisnudeln', 'Reisnudeln')).toBe('sehr dünne rote');
  });

  it('strips punctuation around the dropped words', () => {
    expect(droppedQualifier('Reisnudeln, dünn', 'Reisnudeln')).toBe('dünn');
  });

  it('returns nothing when only punctuation would remain', () => {
    expect(droppedQualifier('Reisnudeln,', 'Reisnudeln')).toBe('');
  });

  it('returns nothing when the new name is a replacement rather than a narrowing', () => {
    expect(droppedQualifier('dünne Reisnudeln', 'Glasnudeln')).toBe('');
  });
});
