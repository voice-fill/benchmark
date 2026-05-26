import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDb, insertRun, queryRuns, type BenchmarkDb, type RunRow } from '../src/db.js';

describe('database', () => {
  let db: BenchmarkDb;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates the runs table', () => {
    const tables = db.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='runs'",
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('inserts and retrieves a run', () => {
    const row: Omit<RunRow, 'id'> = {
      run_id: 'test-run-1',
      created_at: '2026-05-26T10:00:00Z',
      provider: 'openai-whisper',
      audio_file: 'speaker01-ljubljana.mp3',
      dialect: 'ljubljana',
      condition: 'clean',
      reference_text: 'pozdravljen svet',
      hypothesis_text: 'pozdravljen svat',
      wer: 0.5,
      latency_ms: 1200,
      duration_s: 3.5,
      cost_usd: 0.00035,
      language_detected: 'sl',
    };

    insertRun(db, row);
    const runs = queryRuns(db);
    expect(runs).toHaveLength(1);
    expect(runs[0].provider).toBe('openai-whisper');
    expect(runs[0].wer).toBe(0.5);
    expect(runs[0].run_id).toBe('test-run-1');
  });

  it('queries runs filtered by run_id', () => {
    const base = {
      created_at: '2026-05-26T10:00:00Z',
      provider: 'openai-whisper',
      audio_file: 'test.mp3',
      dialect: 'ljubljana',
      condition: 'clean',
      reference_text: 'ref',
      hypothesis_text: 'hyp',
      wer: 0.1,
      latency_ms: 500,
      duration_s: 2.0,
      cost_usd: 0.0002,
      language_detected: 'sl',
    };

    insertRun(db, { ...base, run_id: 'run-a' });
    insertRun(db, { ...base, run_id: 'run-b' });

    const runs = queryRuns(db, { runId: 'run-a' });
    expect(runs).toHaveLength(1);
    expect(runs[0].run_id).toBe('run-a');
  });

  it('queries runs filtered by provider', () => {
    const base = {
      run_id: 'run-1',
      created_at: '2026-05-26T10:00:00Z',
      audio_file: 'test.mp3',
      dialect: 'ljubljana',
      condition: 'clean',
      reference_text: 'ref',
      hypothesis_text: 'hyp',
      wer: 0.1,
      latency_ms: 500,
      duration_s: 2.0,
      cost_usd: 0.0002,
      language_detected: 'sl',
    };

    insertRun(db, { ...base, provider: 'openai-whisper' });
    insertRun(db, { ...base, provider: 'deepgram-nova3' });

    const runs = queryRuns(db, { provider: 'deepgram-nova3' });
    expect(runs).toHaveLength(1);
    expect(runs[0].provider).toBe('deepgram-nova3');
  });

  it('handles nullable fields', () => {
    const row: Omit<RunRow, 'id'> = {
      run_id: 'test-run-1',
      created_at: '2026-05-26T10:00:00Z',
      provider: 'openai-whisper',
      audio_file: 'test.mp3',
      dialect: null,
      condition: null,
      reference_text: 'ref',
      hypothesis_text: 'hyp',
      wer: 0.0,
      latency_ms: 500,
      duration_s: null,
      cost_usd: null,
      language_detected: null,
    };

    insertRun(db, row);
    const runs = queryRuns(db);
    expect(runs[0].dialect).toBeNull();
    expect(runs[0].duration_s).toBeNull();
  });
});
