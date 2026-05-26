import { describe, it, expect } from 'vitest';
import { normalizeText } from '../src/normalize.js';

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('Pozdravljen Svet')).toBe('pozdravljen svet');
  });

  it('strips punctuation', () => {
    expect(normalizeText('hello, world! how are you?')).toBe('hello world how are you');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('hello   world    test')).toBe('hello world test');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  hello world  ')).toBe('hello world');
  });

  it('handles combined normalization', () => {
    expect(normalizeText('  Hello, World!   How ARE you?  ')).toBe('hello world how are you');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeText('')).toBe('');
  });

  it('returns empty string for punctuation-only input', () => {
    expect(normalizeText('..., !!!')).toBe('');
  });

  it('preserves Slovenian characters', () => {
    expect(normalizeText('Čestitke, žaba! Šola.')).toBe('čestitke žaba šola');
  });

  it('handles parentheses and quotes', () => {
    expect(normalizeText('"hello" (world)')).toBe('hello world');
  });

  it('handles hyphens between words', () => {
    expect(normalizeText('twenty-one bottles')).toBe('twenty-one bottles');
  });
});
