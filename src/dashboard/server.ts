import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkDb } from '../db.js';
import { queryRuns } from '../db.js';
import { getProviderStats, getDialectStats, getRunIds } from './stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildFilter(query: Record<string, unknown>): { runId?: string; provider?: string } {
  const filter: { runId?: string; provider?: string } = {};
  if (typeof query.runId === 'string') filter.runId = query.runId;
  if (typeof query.provider === 'string') filter.provider = query.provider;
  return filter;
}

export function createDashboardServer(db: BenchmarkDb) {
  const app = express();

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/stats', (req, res) => {
    const filter = buildFilter(req.query);
    const stats = getProviderStats(db, filter);
    res.json(stats);
  });

  app.get('/api/stats/dialects', (req, res) => {
    const filter = buildFilter(req.query);
    const stats = getDialectStats(db, filter);
    res.json(stats);
  });

  app.get('/api/runs', (req, res) => {
    const filter = buildFilter(req.query);
    const runs = queryRuns(db, filter);
    res.json(runs);
  });

  app.get('/api/runs/list', (_req, res) => {
    const runIds = getRunIds(db);
    res.json(runIds);
  });

  return app;
}
