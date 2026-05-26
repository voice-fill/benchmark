import type { BenchmarkDb, RunRow, QueryFilter } from '../db.js';
import { queryRuns } from '../db.js';

export interface ProviderStats {
  provider: string;
  meanWer: number;
  stdWer: number;
  meanLatency: number;
  stdLatency: number;
  meanCost: number;
  count: number;
}

export interface DialectStats {
  provider: string;
  dialect: string;
  meanWer: number;
  count: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function getProviderStats(db: BenchmarkDb, filter?: QueryFilter): ProviderStats[] {
  const runs = queryRuns(db, filter);
  const byProvider = new Map<string, RunRow[]>();

  for (const run of runs) {
    const arr = byProvider.get(run.provider) ?? [];
    arr.push(run);
    byProvider.set(run.provider, arr);
  }

  const stats: ProviderStats[] = [];
  for (const [provider, provRuns] of byProvider) {
    const wers = provRuns.map(r => r.wer);
    const latencies = provRuns.map(r => r.latency_ms);
    const costs = provRuns.filter(r => r.cost_usd != null).map(r => r.cost_usd!);

    stats.push({
      provider,
      meanWer: mean(wers),
      stdWer: stddev(wers),
      meanLatency: mean(latencies),
      stdLatency: stddev(latencies),
      meanCost: costs.length > 0 ? mean(costs) : 0,
      count: provRuns.length,
    });
  }

  return stats.sort((a, b) => a.meanWer - b.meanWer);
}

export function getDialectStats(db: BenchmarkDb, filter?: QueryFilter): DialectStats[] {
  const runs = queryRuns(db, filter);
  const grouped = new Map<string, number[]>();

  for (const run of runs) {
    const dialect = run.dialect ?? 'unknown';
    const key = `${run.provider}::${dialect}`;
    const arr = grouped.get(key) ?? [];
    arr.push(run.wer);
    grouped.set(key, arr);
  }

  const stats: DialectStats[] = [];
  for (const [key, wers] of grouped) {
    const [provider, dialect] = key.split('::');
    stats.push({ provider, dialect, meanWer: mean(wers), count: wers.length });
  }

  return stats;
}

export function getRunIds(db: BenchmarkDb): { run_id: string; created_at: string; count: number }[] {
  const runs = queryRuns(db);
  const byRunId = new Map<string, { created_at: string; count: number }>();

  for (const run of runs) {
    const existing = byRunId.get(run.run_id);
    if (existing) {
      existing.count++;
    } else {
      byRunId.set(run.run_id, { created_at: run.created_at, count: 1 });
    }
  }

  return Array.from(byRunId.entries())
    .map(([run_id, { created_at, count }]) => ({ run_id, created_at, count }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
