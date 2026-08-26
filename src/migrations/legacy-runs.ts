import type Database from 'better-sqlite3';
import { COST_PER_MINUTE } from '../metrics/cost.js';

interface LegacyRow {
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

export function migrateLegacyRuns(db: Database.Database): void {
  const existing = db.prepare("SELECT type FROM sqlite_master WHERE name = 'runs'")
    .get() as { type: string } | undefined;
  if (existing?.type !== 'table') return;

  const rows = db.prepare('SELECT * FROM runs ORDER BY id').all() as LegacyRow[];

  const migrate = db.transaction(() => {
    const runStart = new Map<string, string>();
    for (const row of rows) {
      const earliest = runStart.get(row.run_id);
      if (earliest === undefined || row.created_at < earliest) runStart.set(row.run_id, row.created_at);
    }

    const insertRun = db.prepare(
      'INSERT INTO benchmark_runs (id, created_at, language) VALUES (?, ?, NULL) ON CONFLICT(id) DO NOTHING',
    );
    for (const [runId, createdAt] of runStart) insertRun.run(runId, createdAt);

    const insertProvider = db.prepare(
      'INSERT INTO providers (name, cost_per_minute_usd) VALUES (?, ?) ON CONFLICT(name) DO NOTHING',
    );
    const insertAudioFile = db.prepare(`
      INSERT INTO audio_files (path, condition, dialect, reference_text, duration_s)
      VALUES (@path, @condition, @dialect, @reference_text, @duration_s)
      ON CONFLICT(path) DO UPDATE SET
        duration_s = COALESCE(excluded.duration_s, audio_files.duration_s)
    `);
    const providerId = db.prepare('SELECT id FROM providers WHERE name = ?');
    const audioFileId = db.prepare('SELECT id FROM audio_files WHERE path = ?');
    const insertMeasurement = db.prepare(`
      INSERT INTO measurements (
        run_id, provider_id, audio_file_id, hypothesis_text,
        wer, cer, substitutions, insertions, deletions,
        latency_ms, rtf, cost_usd, language_detected
      ) VALUES (
        @run_id, @provider_id, @audio_file_id, @hypothesis_text,
        @wer, @cer, @substitutions, @insertions, @deletions,
        @latency_ms, @rtf, @cost_usd, @language_detected
      )
      ON CONFLICT (run_id, provider_id, audio_file_id) DO NOTHING
    `);

    for (const row of rows) {
      insertProvider.run(row.provider, COST_PER_MINUTE[row.provider] ?? null);
      insertAudioFile.run({
        path: row.audio_file,
        condition: row.condition,
        dialect: row.dialect,
        reference_text: row.reference_text,
        duration_s: row.duration_s,
      });

      insertMeasurement.run({
        run_id: row.run_id,
        provider_id: (providerId.get(row.provider) as { id: number }).id,
        audio_file_id: (audioFileId.get(row.audio_file) as { id: number }).id,
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
    }

    db.exec('DROP TABLE runs');
  });

  migrate();
  console.log(`Migrated ${rows.length} legacy row(s) into the normalized schema.`);
}
