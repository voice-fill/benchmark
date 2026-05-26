import { Command } from 'commander';
import path from 'node:path';
import { createDb } from './db.js';
import { generateDashboard } from './dashboard/generate.js';

const DB_PATH = path.resolve('results/benchmark.db');

const program = new Command();

program
  .name('dashboard')
  .description('Generate HTML dashboard from benchmark results')
  .option('-o, --output <path>', 'Output HTML path', 'results/dashboard.html')
  .option('-d, --db <path>', 'SQLite database path', DB_PATH)
  .action(async (opts) => {
    const db = createDb(opts.db);
    try {
      await generateDashboard(db, opts.output);
      console.log(`Dashboard written to ${opts.output}`);
    } finally {
      db.close();
    }
  });

program.parse();
