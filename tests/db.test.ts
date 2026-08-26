import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  createDb,
  createBenchmarkRun,
  insertMeasurement,
  queryRuns,
  type BenchmarkDb,
  type RunRow,
} from '../src/db.js';

const measurement: Omit<RunRow, 'id'> = {
  run_id: 'run-1',
  created_at: '2026-05-26T10:00:00Z',
  provider: 'openai-whisper',
  audio_file: 'data/clean/speaker01-ljubljana.mp3',
  dialect: 'ljubljana',
  condition: 'clean',
  reference_text: 'pozdravljen svet',
  hypothesis_text: 'pozdravljen svat',
  wer: 0.5,
  cer: 0.0625,
  substitutions: 1,
  insertions: 0,
  deletions: 0,
  latency_ms: 1200,
  rtf: 0.34,
  duration_s: 3.5,
  cost_usd: 0.00035,
  language_detected: 'sl',
};

function seedRun(db: BenchmarkDb, id = 'run-1', language: string | null = 'sl'): void {
  createBenchmarkRun(db, { id, created_at: '2026-05-26T10:00:00Z', language });
}

describe('schema', () => {
  let db: BenchmarkDb;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates the four entity tables', () => {
    const names = (db.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all() as { name: string }[]).map(r => r.name);

    expect(names).toEqual(['audio_files', 'benchmark_runs', 'measurements', 'providers']);
  });

  it('exposes runs as a view, not a table', () => {
    const runs = db.db.prepare(
      "SELECT type FROM sqlite_master WHERE name='runs'",
    ).get() as { type: string } | undefined;

    expect(runs?.type).toBe('view');
  });

  it('declares foreign keys from measurements to the three parent tables', () => {
    const fks = db.db.pragma('foreign_key_list(measurements)') as { table: string; from: string }[];
    const byTable = Object.fromEntries(fks.map(f => [f.table, f.from]));

    expect(byTable).toEqual({
      benchmark_runs: 'run_id',
      providers: 'provider_id',
      audio_files: 'audio_file_id',
    });
  });

  it('enforces foreign keys at runtime', () => {
    expect(() => insertMeasurement(db, measurement)).toThrow(/FOREIGN KEY/i);
  });
});

describe('writes', () => {
  let db: BenchmarkDb;

  beforeEach(() => {
    db = createDb(':memory:');
    seedRun(db);
  });

  afterEach(() => {
    db.close();
  });

  it('inserts a measurement and reads it back through the runs view', () => {
    insertMeasurement(db, measurement);
    const runs = queryRuns(db);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      run_id: 'run-1',
      created_at: '2026-05-26T10:00:00Z',
      provider: 'openai-whisper',
      audio_file: 'data/clean/speaker01-ljubljana.mp3',
      dialect: 'ljubljana',
      condition: 'clean',
      reference_text: 'pozdravljen svet',
      hypothesis_text: 'pozdravljen svat',
      wer: 0.5,
      cer: 0.0625,
      substitutions: 1,
      latency_ms: 1200,
      rtf: 0.34,
      duration_s: 3.5,
      cost_usd: 0.00035,
      language_detected: 'sl',
    });
  });

  it('stores each provider once no matter how many measurements reference it', () => {
    insertMeasurement(db, measurement);
    insertMeasurement(db, { ...measurement, audio_file: 'data/clean/other.mp3' });

    const providers = db.db.prepare('SELECT name, cost_per_minute_usd FROM providers').all();
    expect(providers).toEqual([{ name: 'openai-whisper', cost_per_minute_usd: 0.006 }]);
  });

  it('stores each audio file once no matter how many providers transcribe it', () => {
    insertMeasurement(db, measurement);
    insertMeasurement(db, { ...measurement, provider: 'deepgram-nova3' });

    const files = db.db.prepare('SELECT path, condition, dialect, duration_s FROM audio_files').all();
    expect(files).toEqual([{
      path: 'data/clean/speaker01-ljubljana.mp3',
      condition: 'clean',
      dialect: 'ljubljana',
      duration_s: 3.5,
    }]);
  });

  it('keeps a known audio duration when a later provider reports none', () => {
    insertMeasurement(db, measurement);
    insertMeasurement(db, { ...measurement, provider: 'deepgram-nova3', duration_s: null });

    const file = db.db.prepare('SELECT duration_s FROM audio_files').get();
    expect(file).toEqual({ duration_s: 3.5 });
  });

  it('rejects the same provider measuring the same file twice within a run', () => {
    insertMeasurement(db, measurement);
    expect(() => insertMeasurement(db, measurement)).toThrow(/UNIQUE/i);
  });

  it('allows the same provider and file across different runs', () => {
    seedRun(db, 'run-2');
    insertMeasurement(db, measurement);
    insertMeasurement(db, { ...measurement, run_id: 'run-2' });

    expect(queryRuns(db)).toHaveLength(2);
  });

  it('handles nullable fields', () => {
    insertMeasurement(db, {
      ...measurement,
      dialect: null,
      condition: null,
      rtf: null,
      duration_s: null,
      cost_usd: null,
      language_detected: null,
    });

    const row = queryRuns(db)[0];
    expect(row.dialect).toBeNull();
    expect(row.condition).toBeNull();
    expect(row.rtf).toBeNull();
    expect(row.duration_s).toBeNull();
    expect(row.cost_usd).toBeNull();
    expect(row.language_detected).toBeNull();
  });

  it('deletes a run and its measurements together', () => {
    insertMeasurement(db, measurement);
    db.db.prepare('DELETE FROM benchmark_runs WHERE id = ?').run('run-1');

    expect(queryRuns(db)).toHaveLength(0);
    expect(db.db.prepare('SELECT COUNT(*) AS n FROM measurements').get()).toEqual({ n: 0 });
  });
});

describe('queries', () => {
  let db: BenchmarkDb;

  beforeEach(() => {
    db = createDb(':memory:');
    seedRun(db, 'run-a');
    seedRun(db, 'run-b');
    insertMeasurement(db, { ...measurement, run_id: 'run-a', provider: 'openai-whisper' });
    insertMeasurement(db, { ...measurement, run_id: 'run-a', provider: 'deepgram-nova3' });
    insertMeasurement(db, { ...measurement, run_id: 'run-b', provider: 'openai-whisper' });
  });

  afterEach(() => {
    db.close();
  });

  it('filters by run_id', () => {
    const runs = queryRuns(db, { runId: 'run-a' });
    expect(runs).toHaveLength(2);
    expect(runs.every(r => r.run_id === 'run-a')).toBe(true);
  });

  it('filters by provider', () => {
    const runs = queryRuns(db, { provider: 'deepgram-nova3' });
    expect(runs).toHaveLength(1);
    expect(runs[0].provider).toBe('deepgram-nova3');
  });

  it('filters by run_id and provider together', () => {
    const runs = queryRuns(db, { runId: 'run-b', provider: 'openai-whisper' });
    expect(runs).toHaveLength(1);
  });
});

describe('legacy flat runs table', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'benchmark-db-'));
    dbPath = path.join(dir, 'legacy.db');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        provider TEXT NOT NULL,
        audio_file TEXT NOT NULL,
        dialect TEXT,
        condition TEXT,
        reference_text TEXT NOT NULL,
        hypothesis_text TEXT NOT NULL,
        wer REAL NOT NULL,
        cer REAL NOT NULL DEFAULT 0,
        substitutions INTEGER NOT NULL DEFAULT 0,
        insertions INTEGER NOT NULL DEFAULT 0,
        deletions INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL,
        rtf REAL,
        duration_s REAL,
        cost_usd REAL,
        language_detected TEXT
      )
    `);
    const insert = legacy.prepare(`
      INSERT INTO runs (run_id, created_at, provider, audio_file, dialect, condition,
        reference_text, hypothesis_text, wer, cer, substitutions, insertions, deletions,
        latency_ms, rtf, duration_s, cost_usd, language_detected)
      VALUES (@run_id, @created_at, @provider, @audio_file, @dialect, @condition,
        @reference_text, @hypothesis_text, @wer, @cer, @substitutions, @insertions, @deletions,
        @latency_ms, @rtf, @duration_s, @cost_usd, @language_detected)
    `);
    insert.run({ ...measurement, created_at: '2026-05-26T10:00:05Z' });
    insert.run({ ...measurement, created_at: '2026-05-26T10:00:00Z', provider: 'deepgram-nova3' });
    insert.run({ ...measurement, run_id: 'run-2', created_at: '2026-05-27T09:00:00Z' });
    legacy.close();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('migrates legacy rows into the normalized tables', () => {
    const db = createDb(dbPath);

    const count = (table: string) =>
      (db.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

    expect(count('benchmark_runs')).toBe(2);
    expect(count('providers')).toBe(2);
    expect(count('audio_files')).toBe(1);
    expect(count('measurements')).toBe(3);
    expect(queryRuns(db)).toHaveLength(3);

    db.close();
  });

  it('dates a migrated run from its earliest measurement', () => {
    const db = createDb(dbPath);
    const run = db.db.prepare('SELECT created_at FROM benchmark_runs WHERE id = ?').get('run-1');

    expect(run).toEqual({ created_at: '2026-05-26T10:00:00Z' });
    db.close();
  });

  it('replaces the legacy table with the view and is idempotent', () => {
    createDb(dbPath).close();
    const db = createDb(dbPath);

    const runs = db.db.prepare("SELECT type FROM sqlite_master WHERE name='runs'").get() as { type: string };
    expect(runs.type).toBe('view');
    expect(queryRuns(db)).toHaveLength(3);

    db.close();
  });
});
