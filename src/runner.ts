import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { BenchmarkProvider } from './providers/types.js';
import type { BenchmarkDb, RunRow } from './db.js';
import { createBenchmarkRun, insertMeasurement } from './db.js';
import { normalizeText } from './metrics/normalize.js';
import { computeWer } from './metrics/wer.js';
import { computeCer } from './metrics/cer.js';
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
  const createdAt = new Date().toISOString();
  const results: RunResult[] = [];

  createBenchmarkRun(config.db, { id: runId, created_at: createdAt, language: config.language });

  for (const file of config.files) {
    const audio = await readFile(file.path);

    for (const provider of config.providers) {
      const startTime = performance.now();
      const transcription = await provider.transcribe(audio, { language: config.language });
      const latencyMs = Math.round(performance.now() - startTime);

      const normalizedRef = normalizeText(file.reference);
      const normalizedHyp = normalizeText(transcription.text);
      const werResult = computeWer(normalizedRef, normalizedHyp);
      const cerResult = computeCer(normalizedRef, normalizedHyp);

      const durationS = transcription.durationInSeconds ?? null;
      const costUsd = durationS != null ? calculateCost(provider.name, durationS) ?? null : null;
      const rtf = durationS != null && durationS > 0 ? latencyMs / (durationS * 1000) : null;

      const row: RunResult = {
        run_id: runId,
        created_at: createdAt,
        provider: provider.name,
        audio_file: file.path,
        dialect: file.dialect,
        condition: file.condition,
        reference_text: normalizedRef,
        hypothesis_text: normalizedHyp,
        wer: werResult.wer,
        cer: cerResult.cer,
        substitutions: werResult.substitutions,
        insertions: werResult.insertions,
        deletions: werResult.deletions,
        latency_ms: latencyMs,
        rtf,
        duration_s: durationS,
        cost_usd: costUsd,
        language_detected: null,
      };

      insertMeasurement(config.db, row);
      results.push(row);

      console.log(`\n  ${provider.name} × ${file.path}`);
      console.log(`  Reference:  ${normalizedRef}`);
      console.log(`  AI output:  ${normalizedHyp}`);
      console.log(`  WER: ${(werResult.wer * 100).toFixed(1)}% | CER: ${(cerResult.cer * 100).toFixed(1)}% | S:${werResult.substitutions} I:${werResult.insertions} D:${werResult.deletions}`);
      console.log(`  Latency: ${latencyMs}ms | RTF: ${rtf != null ? rtf.toFixed(2) : 'n/a'} | Cost: ${costUsd != null ? '$' + costUsd.toFixed(5) : 'n/a'}`);
    }
  }

  return results;
}
