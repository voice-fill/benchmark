import type { BenchmarkProvider } from './types.js';
import {
  createOpenAIWhisperProvider,
  createDeepgramProvider,
  createAssemblyAIProvider,
  createSonioxProvider,
} from './voicefill.js';

export type { BenchmarkProvider, TranscribeResult } from './types.js';

type ProviderFactory = () => BenchmarkProvider;

interface ProviderEntry {
  factory: ProviderFactory;
  envKey: string;
}

const PROVIDER_REGISTRY: Record<string, ProviderEntry> = {
  'openai-whisper':  { factory: createOpenAIWhisperProvider, envKey: 'OPENAI_API_KEY' },
  'deepgram-nova3':  { factory: createDeepgramProvider,      envKey: 'DEEPGRAM_API_KEY' },
  'assemblyai-best': { factory: createAssemblyAIProvider,    envKey: 'ASSEMBLYAI_API_KEY' },
  'soniox-stt':      { factory: createSonioxProvider,        envKey: 'SONIOX_API_KEY' },
};

export function getProvider(name: string): BenchmarkProvider {
  const entry = PROVIDER_REGISTRY[name];
  if (!entry) {
    throw new Error(`Unknown provider: ${name}. Available: ${Object.keys(PROVIDER_REGISTRY).join(', ')}`);
  }
  return entry.factory();
}

export function listProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

export function getAvailableProviders(): BenchmarkProvider[] {
  const available: BenchmarkProvider[] = [];
  for (const [name, entry] of Object.entries(PROVIDER_REGISTRY)) {
    if (process.env[entry.envKey]) {
      available.push(entry.factory());
    } else {
      console.log(`  Skipping ${name} (no ${entry.envKey})`);
    }
  }
  return available;
}

export function registerProvider(name: string, factory: ProviderFactory, envKey: string): void {
  PROVIDER_REGISTRY[name] = { factory, envKey };
}
