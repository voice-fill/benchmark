# @voicefill/benchmark

Benchmark suite for comparing Slovenian speech-to-text providers. Measures **WER** (Word Error Rate), **CER** (Character Error Rate), **latency**, and **cost** across different audio conditions (clean, noisy, dialect). Results are stored in SQLite and visualized in a Chart.js dashboard.

## Providers

| Provider | Model | Cost/min |
|----------|-------|----------|
| `openai-whisper` | Whisper | $0.006 |
| `deepgram-nova3` | Nova-3 | $0.0043 |
| `assemblyai-best` | Best | $0.006 |
| `soniox-stt` | Soniox STT | $0.004 |

All providers use the Vercel AI SDK's `experimental_transcribe` under the hood.

## Setup

```bash
npm install
cp .env.example .env
# Fill in API keys for the providers you want to test
```

## Audio data

Place audio files and their reference transcriptions in condition-specific folders:

```
data/
  clean/          # studio or clear recordings
  noisy/          # background noise, crosstalk, street noise
  dialect/        # regional Slovenian dialects
```

Each audio file (mp3, wav, m4a, flac, ogg, webm) needs a matching `.txt` file with the ground-truth transcription. Files without a `.txt` pair are skipped.

Dialect is parsed from the filename suffix (e.g., `test04-primorska.mp3`).

Audio files are gitignored; reference `.txt` files are committed.

## Usage

```bash
# Run benchmark with all providers that have API keys set
make benchmark

# Run with a specific provider
make benchmark-openai
npx tsx src/cli.ts run --providers deepgram-nova3,soniox-stt

# List registered providers
make providers

# Start the dashboard (http://localhost:3001)
make dashboard
```

### CLI options

```bash
npx tsx src/cli.ts run [options]

  --providers <list>   Comma-separated provider names (default: all with keys)
  --language <code>    Language code (default: sl)

npx tsx src/dashboard.ts [options]

  -p, --port <number>  Port (default: 3001)
  -d, --db <path>      SQLite database path (default: results/benchmark.db)
```

## Dashboard

The dashboard serves a Chart.js frontend from an Express server, reading from the SQLite database.

**API endpoints:**

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Per-provider aggregated metrics |
| `GET /api/stats/dialects` | WER breakdown by provider and dialect |
| `GET /api/runs` | Raw run data (filter with `?provider=X&runId=Y`) |
| `GET /api/runs/list` | List of benchmark run IDs |

## Database

Results live in `results/benchmark.db` (SQLite). The schema is normalized with foreign keys:

| Table | Grain | Key columns |
|-------|-------|-------------|
| `benchmark_runs` | one CLI invocation | `id` (UUID) PK, `created_at`, `language` |
| `providers` | one ASR provider | `id` PK, `name` UNIQUE, `cost_per_minute_usd` |
| `audio_files` | one recording | `id` PK, `path` UNIQUE, `condition`, `dialect`, `reference_text`, `duration_s` |
| `measurements` | one provider x one file within one run | `id` PK, FKs to all three tables, `UNIQUE (run_id, provider_id, audio_file_id)` |

`measurements.run_id` cascades on delete, so removing a run removes its measurements. The `runs` **view** joins the four tables back into a flat row and is what `/api/runs`, the stats module and the dashboard read.

The full DDL is in [`docs/schema.sql`](docs/schema.sql) and the entity diagram in [`docs/er-diagram.svg`](docs/er-diagram.svg).

Opening the `.db` file in DBeaver (or any client with an ER view) now draws the three relationships automatically.

## Metrics

- **WER** -- Word Error Rate via word-level Levenshtein distance
- **CER** -- Character Error Rate via character-level Levenshtein distance
- **Latency** -- wall-clock time per transcription call (ms)
- **RTF** -- Real-Time Factor (latency / audio duration)
- **Cost** -- estimated USD based on audio duration and provider pricing

Text is normalized before comparison: lowercased, punctuation stripped, whitespace collapsed. Slovenian characters (c, s, z) are preserved.

## Tests

```bash
npm test            # run all tests
npm run test:watch  # watch mode
npm run typecheck   # type check
```

## Adding a provider

1. Create a factory function in `src/providers/voicefill.ts` using the `makeProvider` helper
2. Register it in `PROVIDER_REGISTRY` in `src/providers/index.ts` with its env key
3. Add cost-per-minute to `src/metrics/cost.ts`
4. Add the env var to `.env.example`
