import { describe, expect, it } from 'vitest';
import { classifyAudioPath } from '../src/classify-audio-path.js';

describe('classifyAudioPath', () => {
  it('reads the dialect from the filename suffix of files in the dialect folder', () => {
    expect(classifyAudioPath('data/dialect/rog-p0011-prlekija.mp3')).toEqual({
      condition: 'dialect',
      dialect: 'prlekija',
    });
  });

  it('does not treat the suffix of a noisy file as a dialect', () => {
    expect(classifyAudioPath('data/noisy/test01-crosstalk.mp3')).toEqual({
      condition: 'noisy',
      dialect: null,
    });
  });

  it('does not treat the suffix of a clean file as a dialect', () => {
    expect(classifyAudioPath('data/clean/fleurs-01.mp3')).toEqual({
      condition: 'clean',
      dialect: null,
    });
  });

  it('leaves files outside the known folders unclassified', () => {
    expect(classifyAudioPath('data/misc/sample-stajerska.wav')).toEqual({
      condition: null,
      dialect: null,
    });
  });
});
