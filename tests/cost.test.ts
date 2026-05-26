import { describe, it, expect } from 'vitest';
import { calculateCost, COST_PER_MINUTE } from '../src/cost.js';

describe('COST_PER_MINUTE', () => {
  it('has entries for all expected providers', () => {
    const expected = [
      'openai-whisper',
      'deepgram-nova3',
      'assemblyai-best',
      'soniox-stt',
      'elevenlabs-scribe',
      'azure-speech',
      'google-speech',
      'aws-transcribe',
    ];
    for (const provider of expected) {
      expect(COST_PER_MINUTE).toHaveProperty(provider);
    }
  });
});

describe('calculateCost', () => {
  it('calculates cost from duration and provider rate', () => {
    const cost = calculateCost('openai-whisper', 120);
    expect(cost).toBeCloseTo(0.006 * (120 / 60));
  });

  it('returns 0 for 0 duration', () => {
    expect(calculateCost('openai-whisper', 0)).toBe(0);
  });

  it('returns undefined for unknown provider', () => {
    expect(calculateCost('unknown-provider', 60)).toBeUndefined();
  });

  it('handles fractional durations', () => {
    const cost = calculateCost('deepgram-nova3', 45.5);
    expect(cost).toBeCloseTo(0.0043 * (45.5 / 60));
  });
});
