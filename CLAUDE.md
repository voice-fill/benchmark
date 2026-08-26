# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Slovenian ASR (speech-to-text) benchmark. Compares transcription accuracy across providers (OpenAI Whisper, Deepgram Nova 3, AssemblyAI, Soniox) on Slovenian audio under different conditions (clean, noisy, dialect). Results go into a SQLite database; a dashboard visualizes them.

## Workflow

1. **Get audio**: Use `yt-dlp` to download videos, extract audio into `data/{clean,noisy,dialect}/`
2. **Write reference text**: Create a `.txt` file with the same name as each audio file containing the correct transcription
3. **Run benchmark**: `make benchmark` sends each audio file to all configured providers and records WER/CER/latency/cost
4. **View results**: `make dashboard` at http://localhost:3001

Audio files are gitignored. The `.txt` reference files are committed.

## Commands

```bash
npm install                                    # install deps
make benchmark                                 # run all providers with API keys set in .env
make benchmark-openai                          # run only openai-whisper
npx tsx src/cli.ts run --providers deepgram-nova3,soniox-stt  # specific providers
npx tsx src/cli.ts providers                   # list registered providers
make dashboard                                 # start dashboard server
npm test                                       # run tests (vitest)
npm run test:watch                             # watch mode
npm run typecheck                              # tsc --noEmit
```

## Adding Audio Files

Each audio file needs a matching `.txt` with the reference transcription. Place files in the appropriate condition folder:

- `data/clean/` — studio or clear recordings
- `data/noisy/` — background noise, multiple speakers, etc.
- `data/dialect/` — regional Slovenian dialects; filename suffix `-{dialect}` is parsed (e.g., `test01-prekmurje.mp3`)

Supported audio formats: mp3, wav, m4a, flac, ogg, webm.

## Adding a Provider

1. Add SDK dependency and create/export a factory function in `src/providers/voicefill.ts` using the `makeProvider` helper (all providers use Vercel AI SDK's `experimental_transcribe`)
2. Register it in `PROVIDER_REGISTRY` in `src/providers/index.ts` with its env key
3. Add cost-per-minute to `src/metrics/cost.ts`
4. Add the env var to `.env.example`

## Architecture

- **Providers** use Vercel AI SDK (`experimental_transcribe`) — not raw HTTP. Each provider wraps a transcription model from its `@ai-sdk/*` package.
- **Metrics**: WER and CER computed via edit-distance DP. Text is normalized (lowercase, strip punctuation, collapse whitespace) before comparison.
- **DB**: SQLite via `better-sqlite3` at `results/benchmark.db`, normalized into four tables with foreign keys: `benchmark_runs` (one per CLI invocation, UUID id), `providers`, `audio_files` (path, condition, dialect, reference text, duration), and `measurements` (one per run x provider x file, `UNIQUE (run_id, provider_id, audio_file_id)`). `PRAGMA foreign_keys = ON`; deleting a run cascades to its measurements.
- **`runs` view**: a `CREATE VIEW` that joins all four tables back into the old flat row shape. Stats, the API and the dashboard frontend read only this view, so they never join by hand. Write through `createBenchmarkRun()` + `insertMeasurement()` in `src/db.ts` - the latter upserts the provider and audio file, then inserts the measurement in one transaction.
- **Legacy migration**: `src/migrations/legacy-runs.ts` detects a pre-normalization flat `runs` *table*, copies its rows into the new tables and drops it. It runs automatically from `createDb()` and is a no-op afterwards.
- **Dashboard**: Express server serving Chart.js frontend, reads from the same SQLite DB.

## Data Conventions

- Condition (`clean`/`noisy`/`dialect`) is derived from the parent directory name
- Dialect is parsed from the audio filename suffix (e.g., `-prekmurje`)
- Files without a matching `.txt` are skipped with a warning
