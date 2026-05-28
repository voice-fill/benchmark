import { describe, it, expect } from 'vitest';
import { computeCer } from '../src/metrics/cer.js';

describe('computeCer', () => {
  it('returns 0 for identical texts', () => {
    const result = computeCer('pozdravljen svet', 'pozdravljen svet');
    expect(result.cer).toBe(0);
    expect(result.substitutions).toBe(0);
    expect(result.insertions).toBe(0);
    expect(result.deletions).toBe(0);
  });

  it('detects single character substitution', () => {
    const result = computeCer('svet', 'svat');
    expect(result.cer).toBeCloseTo(1 / 4);
    expect(result.substitutions).toBe(1);
  });

  it('detects diacritics errors (č → c)', () => {
    const result = computeCer('čas', 'cas');
    expect(result.cer).toBeCloseTo(1 / 3);
    expect(result.substitutions).toBe(1);
  });

  it('detects missing diacritics on multiple characters', () => {
    const result = computeCer('šč', 'sc');
    expect(result.cer).toBeCloseTo(1);
    expect(result.substitutions).toBe(2);
  });

  it('handles insertion', () => {
    const result = computeCer('ab', 'axb');
    expect(result.cer).toBeCloseTo(1 / 2);
    expect(result.insertions).toBe(1);
  });

  it('handles deletion', () => {
    const result = computeCer('abc', 'ac');
    expect(result.cer).toBeCloseTo(1 / 3);
    expect(result.deletions).toBe(1);
  });

  it('handles empty hypothesis', () => {
    const result = computeCer('hello', '');
    expect(result.cer).toBe(1);
    expect(result.deletions).toBe(5);
  });

  it('handles empty reference', () => {
    const result = computeCer('', 'hello');
    expect(result.cer).toBe(Infinity);
  });

  it('handles both empty', () => {
    const result = computeCer('', '');
    expect(result.cer).toBe(0);
  });

  it('handles unicode characters correctly', () => {
    const result = computeCer('žž', 'žž');
    expect(result.cer).toBe(0);
    expect(result.referenceLength).toBe(2);
  });
});
