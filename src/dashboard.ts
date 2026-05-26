import { Command } from 'commander';
import path from 'node:path';
import { createDb } from './db.js';
import { createDashboardServer } from './dashboard/server.js';

const DB_PATH = path.resolve('results/benchmark.db');

const program = new Command();

program
  .name('dashboard')
  .description('Serve benchmark results dashboard')
  .option('-p, --port <number>', 'Port to listen on', '3001')
  .option('-d, --db <path>', 'SQLite database path', DB_PATH)
  .action((opts) => {
    const db = createDb(opts.db);
    const app = createDashboardServer(db);
    const port = parseInt(opts.port, 10);

    app.listen(port, () => {
      console.log(`Dashboard running at http://localhost:${port}`);
      console.log(`Database: ${opts.db}`);
      console.log();
      console.log('API endpoints:');
      console.log('  GET /api/stats          — per-provider aggregates');
      console.log('  GET /api/stats/dialects  — WER by provider × dialect');
      console.log('  GET /api/runs           — raw runs (?provider=X&runId=Y)');
      console.log('  GET /api/runs/list      — list of benchmark run IDs');
    });

    process.on('SIGINT', () => {
      db.close();
      process.exit(0);
    });
  });

program.parse();
