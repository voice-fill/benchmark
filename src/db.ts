import Database from 'better-sqlite3';

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
  latency_ms: number;
  duration_s: number | null;
  cost_usd: number | null;
  language_detected: string | null;
}

export interface BenchmarkDb {
  db: Database.Database;
  close(): void;
}

export function createDb(path: string): BenchmarkDb {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
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
      latency_ms INTEGER NOT NULL,
      duration_s REAL,
      cost_usd REAL,
      language_detected TEXT
    )
  `);

  return {
    db,
    close() {
      db.close();
    },
  };
}

const INSERT_SQL = `
  INSERT INTO runs (
    run_id, created_at, provider, audio_file, dialect, condition,
    reference_text, hypothesis_text, wer, latency_ms, duration_s,
    cost_usd, language_detected
  ) VALUES (
    @run_id, @created_at, @provider, @audio_file, @dialect, @condition,
    @reference_text, @hypothesis_text, @wer, @latency_ms, @duration_s,
    @cost_usd, @language_detected
  )
`;

export function insertRun(benchmarkDb: BenchmarkDb, row: Omit<RunRow, 'id'>): void {
  benchmarkDb.db.prepare(INSERT_SQL).run(row);
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
