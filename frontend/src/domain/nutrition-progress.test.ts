import { describe, expect, it } from 'vitest';
import { kcalStatus, macroStatus } from './nutrition-progress';

describe('kcalStatus', () => {
  it('returns neutral when goal is null, undefined, or zero', () => {
    expect(kcalStatus(1500, null)).toEqual({ pct: null, color: 'neutral', badge: null });
    expect(kcalStatus(1500, undefined)).toEqual({ pct: null, color: 'neutral', badge: null });
    expect(kcalStatus(1500, 0)).toEqual({ pct: null, color: 'neutral', badge: null });
  });

  it('returns green + reached when actual exactly matches goal', () => {
    const result = kcalStatus(2000, 2000);
    expect(result.color).toBe('green');
    expect(result.badge).toEqual({ kind: 'reached', diff: 0 });
    expect(result.pct).toBe(100);
  });

  it('rounds actual before comparing for reached (2000.3 kcal still counts as 2000)', () => {
    const result = kcalStatus(2000.3, 2000);
    expect(result.color).toBe('green');
    expect(result.badge).toEqual({ kind: 'reached', diff: 0 });
  });

  it('below 80 % is red + open', () => {
    const result = kcalStatus(1500, 2000);
    expect(result.color).toBe('red');
    expect(result.badge).toEqual({ kind: 'open', diff: 500 });
  });

  it('exactly 80 % is yellow + open', () => {
    const result = kcalStatus(1600, 2000);
    expect(result.color).toBe('yellow');
    expect(result.badge).toEqual({ kind: 'open', diff: 400 });
  });

  it('99 % is yellow + open', () => {
    const result = kcalStatus(1980, 2000);
    expect(result.color).toBe('yellow');
    expect(result.badge).toEqual({ kind: 'open', diff: 20 });
  });

  it('any overshoot is at least yellow + over', () => {
    const result = kcalStatus(2001, 2000);
    expect(result.color).toBe('yellow');
    expect(result.badge).toEqual({ kind: 'over', diff: 1 });
  });

  it('120 % is yellow + over', () => {
    const result = kcalStatus(2400, 2000);
    expect(result.color).toBe('yellow');
    expect(result.badge).toEqual({ kind: 'over', diff: 400 });
  });

  it('over 120 % is red + over', () => {
    const result = kcalStatus(2401, 2000);
    expect(result.color).toBe('red');
    expect(result.badge).toEqual({ kind: 'over', diff: 401 });
  });

  it('zero actual is red + open', () => {
    const result = kcalStatus(0, 2000);
    expect(result.color).toBe('red');
    expect(result.badge).toEqual({ kind: 'open', diff: 2000 });
    expect(result.pct).toBe(0);
  });
});

describe('macroStatus', () => {
  it('returns neutral when goal is falsy', () => {
    expect(macroStatus(50, null)).toEqual({ pct: null, color: 'neutral' });
    expect(macroStatus(50, undefined)).toEqual({ pct: null, color: 'neutral' });
    expect(macroStatus(50, 0)).toEqual({ pct: null, color: 'neutral' });
  });

  it('90 % is green (lower edge inclusive)', () => {
    expect(macroStatus(90, 100).color).toBe('green');
  });

  it('110 % is green (upper edge inclusive)', () => {
    expect(macroStatus(110, 100).color).toBe('green');
  });

  it('100 % is green', () => {
    expect(macroStatus(100, 100).color).toBe('green');
  });

  it('89 % is yellow', () => {
    expect(macroStatus(89, 100).color).toBe('yellow');
  });

  it('80 % is yellow (inclusive)', () => {
    expect(macroStatus(80, 100).color).toBe('yellow');
  });

  it('111 % is yellow', () => {
    expect(macroStatus(111, 100).color).toBe('yellow');
  });

  it('120 % is yellow (inclusive)', () => {
    expect(macroStatus(120, 100).color).toBe('yellow');
  });

  it('under 80 % is red', () => {
    expect(macroStatus(79, 100).color).toBe('red');
  });

  it('over 120 % is red', () => {
    expect(macroStatus(121, 100).color).toBe('red');
  });
});
