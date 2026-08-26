import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBenchmark, type AudioFile } from '../src/runner.js';
import type { BenchmarkProvider } from '../src/providers/types.js';
import type { BenchmarkDb, RunRow } from '../src/db.js';

function createMockProvider(name: string, responseText: string): BenchmarkProvider {
  return {
    name,
    transcribe: vi.fn().mockResolvedValue({
      text: responseText,
      durationInSeconds: 5.0,
    }),
  };
}

function createMockDb(): BenchmarkDb {
  return {
    db: {} as any,
    close: vi.fn(),
  };
}

const createBenchmarkRun = vi.hoisted(() => vi.fn());
const insertMeasurement = vi.hoisted(() => vi.fn());
vi.mock('../src/db.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/db.js')>();
  return {
    ...mod,
    createBenchmarkRun: (...args: unknown[]) => {
      createBenchmarkRun(...args);
    },
    insertMeasurement: (...args: unknown[]) => {
      insertMeasurement(...args);
    },
  };
});

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-audio-data')),
}));

describe('runBenchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs a single file through a single provider and inserts a result', async () => {
    const provider = createMockProvider('test-provider', 'pozdravljen svat');
    const db = createMockDb();
    const files: AudioFile[] = [{
      path: 'data/clean/speaker01-ljubljana.mp3',
      reference: 'pozdravljen svet',
      dialect: 'ljubljana',
      condition: 'clean',
    }];

    const results = await runBenchmark({
      providers: [provider],
      files,
      db,
      language: 'sl',
    });

    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe('test-provider');
    expect(results[0].wer).toBeGreaterThan(0);
    expect(results[0].latency_ms).toBeGreaterThanOrEqual(0);
    expect(provider.transcribe).toHaveBeenCalledOnce();
    expect(createBenchmarkRun).toHaveBeenCalledOnce();
    expect(insertMeasurement).toHaveBeenCalledOnce();
  });

  it('runs multiple files through multiple providers', async () => {
    const providers = [
      createMockProvider('provider-a', 'hello world'),
      createMockProvider('provider-b', 'hello world'),
    ];
    const db = createMockDb();
    const files: AudioFile[] = [
      { path: 'data/clean/test1.mp3', reference: 'hello world', dialect: 'ljubljana', condition: 'clean' },
      { path: 'data/clean/test2.mp3', reference: 'foo bar', dialect: 'stajerska', condition: 'clean' },
    ];

    const results = await runBenchmark({
      providers,
      files,
      db,
      language: 'sl',
    });

    expect(results).toHaveLength(4);
    expect(createBenchmarkRun).toHaveBeenCalledOnce();
    expect(insertMeasurement).toHaveBeenCalledTimes(4);
  });

  it('computes WER using normalized texts', async () => {
    const provider = createMockProvider('test-provider', 'Pozdravljen, Svet!');
    const db = createMockDb();
    const files: AudioFile[] = [{
      path: 'data/clean/test.mp3',
      reference: 'POZDRAVLJEN SVET',
      dialect: null,
      condition: null,
    }];

    const results = await runBenchmark({
      providers: [provider],
      files,
      db,
      language: 'sl',
    });

    expect(results[0].wer).toBe(0);
  });

  it('calculates cost from provider name and duration', async () => {
    const provider = createMockProvider('openai-whisper', 'test');
    const db = createMockDb();
    const files: AudioFile[] = [{
      path: 'data/clean/test.mp3',
      reference: 'test',
      dialect: null,
      condition: null,
    }];

    const results = await runBenchmark({
      providers: [provider],
      files,
      db,
      language: 'sl',
    });

    expect(results[0].cost_usd).toBeCloseTo(0.006 * (5.0 / 60));
  });
});
