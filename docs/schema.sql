CREATE TABLE providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    cost_per_minute_usd REAL
  );
CREATE TABLE audio_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    condition TEXT,
    dialect TEXT,
    reference_text TEXT NOT NULL,
    duration_s REAL
  );
CREATE TABLE benchmark_runs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    language TEXT
  );
CREATE TABLE measurements (
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
CREATE INDEX idx_measurements_run ON measurements(run_id);
CREATE INDEX idx_measurements_provider ON measurements(provider_id);
CREATE INDEX idx_measurements_audio_file ON measurements(audio_file_id);
CREATE VIEW runs AS
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
  JOIN audio_files a ON a.id = m.audio_file_id
/* runs(id,run_id,created_at,provider,audio_file,dialect,condition,reference_text,hypothesis_text,wer,cer,substitutions,insertions,deletions,latency_ms,rtf,duration_s,cost_usd,language_detected) */;
