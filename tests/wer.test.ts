import { describe, it, expect } from 'vitest';
import { computeWer } from '../src/wer.js';

describe('computeWer', () => {
  it('returns 0 for identical texts', () => {
    const result = computeWer('the cat sat on the mat', 'the cat sat on the mat');
    expect(result.wer).toBe(0);
    expect(result.substitutions).toBe(0);
    expect(result.insertions).toBe(0);
    expect(result.deletions).toBe(0);
  });

  it('calculates substitutions', () => {
    const result = computeWer('the cat sat', 'the dog sat');
    expect(result.wer).toBeCloseTo(1 / 3);
    expect(result.substitutions).toBe(1);
    expect(result.insertions).toBe(0);
    expect(result.deletions).toBe(0);
  });

  it('calculates insertions', () => {
    const result = computeWer('the cat', 'the big cat');
    expect(result.wer).toBeCloseTo(1 / 2);
    expect(result.insertions).toBe(1);
  });

  it('calculates deletions', () => {
    const result = computeWer('the big cat', 'the cat');
    expect(result.wer).toBeCloseTo(1 / 3);
    expect(result.deletions).toBe(1);
  });

  it('handles completely wrong hypothesis', () => {
    const result = computeWer('hello world', 'foo bar baz');
    expect(result.wer).toBeCloseTo(3 / 2);
    expect(result.substitutions).toBe(2);
    expect(result.insertions).toBe(1);
    expect(result.deletions).toBe(0);
  });

  it('handles empty hypothesis', () => {
    const result = computeWer('hello world', '');
    expect(result.wer).toBe(1);
    expect(result.deletions).toBe(2);
  });

  it('handles empty reference', () => {
    const result = computeWer('', 'hello world');
    expect(result.wer).toBe(Infinity);
  });

  it('handles both empty', () => {
    const result = computeWer('', '');
    expect(result.wer).toBe(0);
  });

  it('returns word counts', () => {
    const result = computeWer('one two three four', 'one two three four');
    expect(result.referenceLength).toBe(4);
  });
});
