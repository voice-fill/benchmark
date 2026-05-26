import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { BenchmarkProvider } from './providers/types.js';
import type { BenchmarkDb, RunRow } from './db.js';
import { insertRun } from './db.js';
import { normalizeText } from './metrics/normalize.js';
import { computeWer } from './metrics/wer.js';
import { calculateCost } from './metrics/cost.js';

export interface AudioFile {
  path: string;
  reference: string;
  dialect: string | null;
  condition: string | null;
}

export interface RunConfig {
  providers: BenchmarkProvider[];
  files: AudioFile[];
  db: BenchmarkDb;
  language: string;
}

export type RunResult = Omit<RunRow, 'id'>;

export async function runBenchmark(config: RunConfig): Promise<RunResult[]> {
  const runId = randomUUID();
  const results: RunResult[] = [];

  for (const file of config.files) {
    const audio = await readFile(file.path);

    for (const provider of config.providers) {
      const startTime = performance.now();
      const transcription = await provider.transcribe(audio, { language: config.language });
      const latencyMs = Math.round(performance.now() - startTime);

      const normalizedRef = normalizeText(file.reference);
      const normalizedHyp = normalizeText(transcription.text);
      const werResult = computeWer(normalizedRef, normalizedHyp);

      const durationS = transcription.durationInSeconds ?? null;
      const costUsd = durationS != null ? calculateCost(provider.name, durationS) ?? null : null;

      const row: RunResult = {
        run_id: runId,
        created_at: new Date().toISOString(),
        provider: provider.name,
        audio_file: file.path,
        dialect: file.dialect,
        condition: file.condition,
        reference_text: normalizedRef,
        hypothesis_text: normalizedHyp,
        wer: werResult.wer,
        latency_ms: latencyMs,
        duration_s: durationS,
        cost_usd: costUsd,
        language_detected: null,
      };

      insertRun(config.db, row);
      results.push(row);

      console.log(
        `  ${provider.name} × ${file.path} → WER: ${(werResult.wer * 100).toFixed(1)}%, ${latencyMs}ms`,
      );
    }
  }

  return results;
}
