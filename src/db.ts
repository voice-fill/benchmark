import Database from 'better-sqlite3';
import { COST_PER_MINUTE } from './metrics/cost.js';
import { migrateLegacyRuns } from './migrations/legacy-runs.js';

export interface BenchmarkRunRow {
  id: string;
  created_at: string;
  language: string | null;
}

export interface RunRow {
  id?: number;
  run_id: string;
  created_at: string;
  provider: string;
  audio_file: string;
  dialect: string | null;
  condition: string | null;
  reference_text: string;
  hypothesis_text: string;
  wer: number;
  cer: number;
  substitutions: number;
  insertions: number;
  deletions: number;
  latency_ms: number;
  rtf: number | null;
  duration_s: number | null;
  cost_usd: number | null;
  language_detected: string | null;
}

export interface BenchmarkDb {
  db: Database.Database;
  close(): void;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    cost_per_minute_usd REAL
  );

  CREATE TABLE IF NOT EXISTS audio_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    condition TEXT,
    dialect TEXT,
    reference_text TEXT NOT NULL,
    duration_s REAL
  );

  CREATE TABLE IF NOT EXISTS benchmark_runs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    language TEXT
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
    audio_file_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE RESTRICT,
    hypothesis_text TEXT NOT NULL,
    wer REAL NOT NULL,
    cer REAL NOT NULL DEFAULT 0,
    substitutions INTEGER NOT NULL DEFAULT 0,
    insertions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL,
    rtf REAL,
    cost_usd REAL,
    language_detected TEXT,
    UNIQUE (run_id, provider_id, audio_file_id)
  );

  CREATE INDEX IF NOT EXISTS idx_measurements_run ON measurements(run_id);
  CREATE INDEX IF NOT EXISTS idx_measurements_provider ON measurements(provider_id);
  CREATE INDEX IF NOT EXISTS idx_measurements_audio_file ON measurements(audio_file_id);
`;

const RUNS_VIEW = `
  CREATE VIEW IF NOT EXISTS runs AS
  SELECT
    m.id AS id,
    m.run_id AS run_id,
    r.created_at AS created_at,
    p.name AS provider,
    a.path AS audio_file,
    a.dialect AS dialect,
    a.condition AS condition,
    a.reference_text AS reference_text,
    m.hypothesis_text AS hypothesis_text,
    m.wer AS wer,
    m.cer AS cer,
    m.substitutions AS substitutions,
    m.insertions AS insertions,
    m.deletions AS deletions,
    m.latency_ms AS latency_ms,
    m.rtf AS rtf,
    a.duration_s AS duration_s,
    m.cost_usd AS cost_usd,
    m.language_detected AS language_detected
  FROM measurements m
  JOIN benchmark_runs r ON r.id = m.run_id
  JOIN providers p ON p.id = m.provider_id
  JOIN audio_files a ON a.id = m.audio_file_id;
`;

export function createDb(path: string): BenchmarkDb {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrateLegacyRuns(db);
  db.exec(RUNS_VIEW);

  return {
    db,
    close() {
      db.close();
    },
  };
}

const INSERT_RUN_SQL = `
  INSERT INTO benchmark_runs (id, created_at, language)
  VALUES (@id, @created_at, @language)
  ON CONFLICT(id) DO NOTHING
`;

export function createBenchmarkRun(benchmarkDb: BenchmarkDb, run: BenchmarkRunRow): void {
  benchmarkDb.db.prepare(INSERT_RUN_SQL).run(run);
}

const UPSERT_PROVIDER_SQL = `
  INSERT INTO providers (name, cost_per_minute_usd)
  VALUES (@name, @cost_per_minute_usd)
  ON CONFLICT(name) DO UPDATE SET
    cost_per_minute_usd = COALESCE(excluded.cost_per_minute_usd, providers.cost_per_minute_usd)
`;

const UPSERT_AUDIO_FILE_SQL = `
  INSERT INTO audio_files (path, condition, dialect, reference_text, duration_s)
  VALUES (@path, @condition, @dialect, @reference_text, @duration_s)
  ON CONFLICT(path) DO UPDATE SET
    condition = excluded.condition,
    dialect = excluded.dialect,
    reference_text = excluded.reference_text,
    duration_s = COALESCE(excluded.duration_s, audio_files.duration_s)
`;

const INSERT_MEASUREMENT_SQL = `
  INSERT INTO measurements (
    run_id, provider_id, audio_file_id, hypothesis_text,
    wer, cer, substitutions, insertions, deletions,
    latency_ms, rtf, cost_usd, language_detected
  ) VALUES (
    @run_id, @provider_id, @audio_file_id, @hypothesis_text,
    @wer, @cer, @substitutions, @insertions, @deletions,
    @latency_ms, @rtf, @cost_usd, @language_detected
  )
`;

export function insertMeasurement(benchmarkDb: BenchmarkDb, row: Omit<RunRow, 'id'>): void {
  const { db } = benchmarkDb;

  const write = db.transaction(() => {
    db.prepare(UPSERT_PROVIDER_SQL).run({
      name: row.provider,
      cost_per_minute_usd: COST_PER_MINUTE[row.provider] ?? null,
    });
    db.prepare(UPSERT_AUDIO_FILE_SQL).run({
      path: row.audio_file,
      condition: row.condition,
      dialect: row.dialect,
      reference_text: row.reference_text,
      duration_s: row.duration_s,
    });

    const { id: providerId } = db.prepare('SELECT id FROM providers WHERE name = ?')
      .get(row.provider) as { id: number };
    const { id: audioFileId } = db.prepare('SELECT id FROM audio_files WHERE path = ?')
      .get(row.audio_file) as { id: number };

    db.prepare(INSERT_MEASUREMENT_SQL).run({
      run_id: row.run_id,
      provider_id: providerId,
      audio_file_id: audioFileId,
      hypothesis_text: row.hypothesis_text,
      wer: row.wer,
      cer: row.cer,
      substitutions: row.substitutions,
      insertions: row.insertions,
      deletions: row.deletions,
      latency_ms: row.latency_ms,
      rtf: row.rtf,
      cost_usd: row.cost_usd,
      language_detected: row.language_detected,
    });
  });

  write();
}

export interface QueryFilter {
  runId?: string;
  provider?: string;
}

export function queryRuns(benchmarkDb: BenchmarkDb, filter?: QueryFilter): RunRow[] {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (filter?.runId) {
    conditions.push('run_id = @runId');
    params.runId = filter.runId;
  }
  if (filter?.provider) {
    conditions.push('provider = @provider');
    params.provider = filter.provider;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return benchmarkDb.db.prepare(`SELECT * FROM runs ${where} ORDER BY id`).all(params) as RunRow[];
}
