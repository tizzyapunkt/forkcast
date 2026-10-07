import { formatDecimal, formatFixed, formatSigned, parseDecimal } from './decimal';

describe('parseDecimal', () => {
  it('parses a plain integer string', () => {
    expect(parseDecimal('100')).toBe(100);
  });

  it('parses a dot as the decimal separator', () => {
    expect(parseDecimal('0.25')).toBe(0.25);
  });

  it('parses a comma as the decimal separator (German locale)', () => {
    expect(parseDecimal('0,25')).toBe(0.25);
  });

  it('accepts both separators in either UI locale (parsing takes no locale)', () => {
    for (const raw of ['1,5', '1.5']) expect(parseDecimal(raw)).toBe(1.5);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDecimal('  1,5  ')).toBe(1.5);
  });

  it('parses a negative value', () => {
    expect(parseDecimal('-2,5')).toBe(-2.5);
  });

  it('returns null for an empty or whitespace-only string', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
  });

  it('returns null for a lone separator', () => {
    expect(parseDecimal(',')).toBeNull();
    expect(parseDecimal('.')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('1.2.3')).toBeNull();
  });
});

describe('formatDecimal', () => {
  it('formats with a dot for an English locale', () => {
    expect(formatDecimal(0.25, 'en-US')).toBe('0.25');
  });

  it('formats with a comma for a German locale', () => {
    expect(formatDecimal(0.25, 'de-DE')).toBe('0,25');
  });

  it('does not group thousands', () => {
    expect(formatDecimal(1500, 'de-DE')).toBe('1500');
  });

  it('drops trailing fraction zeros', () => {
    expect(formatDecimal(2, 'de-DE')).toBe('2');
  });
});

describe('formatFixed', () => {
  it('keeps the given fraction digits with the locale separator', () => {
    expect(formatFixed(80.8, 1, 'de-DE')).toBe('80,8');
    expect(formatFixed(80, 1, 'en-GB')).toBe('80.0');
  });
});

describe('formatSigned', () => {
  it('prefixes a sign on non-zero values', () => {
    expect(formatSigned(-0.76, 2, 'de-DE')).toBe('-0,76');
    expect(formatSigned(0.5, 2, 'en-GB')).toBe('+0.50');
  });

  it('leaves zero unsigned', () => {
    expect(formatSigned(0, 2, 'de-DE')).toBe('0,00');
  });
});
