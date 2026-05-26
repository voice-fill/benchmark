import 'dotenv/config';
import { Command } from 'commander';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createDb } from './db.js';
import { getProvider, listProviders } from './providers/index.js';
import { runBenchmark, type AudioFile } from './runner.js';

const DB_PATH = path.resolve('results/benchmark.db');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.webm']);

async function loadAudioFiles(dataDir: string): Promise<AudioFile[]> {
  const entries = await readdir(dataDir, { recursive: true });
  const files: AudioFile[] = [];

  for (const entry of entries) {
    const ext = path.extname(entry);
    if (!AUDIO_EXTENSIONS.has(ext)) continue;

    const audioPath = path.join(dataDir, entry);
    const txtPath = audioPath.replace(ext, '.txt');
    let reference: string;
    try {
      reference = (await readFile(txtPath, 'utf-8')).trim();
    } catch {
      console.warn(`  Skipping ${audioPath}: no matching .txt file`);
      continue;
    }

    const dir = path.basename(path.dirname(audioPath));
    const condition = ['clean', 'noisy', 'dialect'].includes(dir) ? dir : null;

    const baseName = path.basename(audioPath, ext);
    const dialectMatch = baseName.match(/-([a-z]+)$/);
    const dialect = dialectMatch ? dialectMatch[1] : null;

    files.push({ path: audioPath, reference, dialect, condition });
  }

  return files;
}

const program = new Command();

program
  .name('benchmark')
  .description('Slovenian ASR benchmark CLI');

program
  .command('run')
  .description('Run benchmark on audio files')
  .option('-p, --providers <names>', 'Comma-separated provider names', '')
  .option('-d, --data <dir>', 'Data directory with audio + txt files', 'data')
  .option('-l, --language <code>', 'Language code', 'sl')
  .action(async (opts) => {
    const providerNames = opts.providers
      ? opts.providers.split(',').map((s: string) => s.trim())
      : listProviders();

    console.log(`Providers: ${providerNames.join(', ')}`);
    console.log(`Data dir: ${opts.data}`);
    console.log(`Language: ${opts.language}`);
    console.log();

    const providers = providerNames.map((name: string) => getProvider(name));
    const files = await loadAudioFiles(opts.data);

    if (files.length === 0) {
      console.error('No audio files found. Make sure data/ directory has audio + .txt files.');
      process.exit(1);
    }

    console.log(`Found ${files.length} audio file(s)\n`);

    const db = createDb(DB_PATH);
    try {
      const results = await runBenchmark({
        providers,
        files,
        db,
        language: opts.language,
      });
      console.log(`\nDone! ${results.length} result(s) saved to ${DB_PATH}`);
    } finally {
      db.close();
    }
  });

program
  .command('providers')
  .description('List available providers')
  .action(() => {
    console.log('Available providers:');
    for (const name of listProviders()) {
      console.log(`  - ${name}`);
    }
  });

program.parse();
