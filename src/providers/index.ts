import type { BenchmarkProvider } from './types.js';
import {
  createOpenAIWhisperProvider,
  createDeepgramProvider,
  createAssemblyAIProvider,
  createSonioxProvider,
} from './voicefill.js';

export type { BenchmarkProvider, TranscribeResult } from './types.js';

type ProviderFactory = () => BenchmarkProvider;

const PROVIDER_FACTORIES: Record<string, ProviderFactory> = {
  'openai-whisper': createOpenAIWhisperProvider,
  'deepgram-nova3': createDeepgramProvider,
  'assemblyai-best': createAssemblyAIProvider,
  'soniox-stt': createSonioxProvider,
};

export function getProvider(name: string): BenchmarkProvider {
  const factory = PROVIDER_FACTORIES[name];
  if (!factory) {
    throw new Error(`Unknown provider: ${name}. Available: ${Object.keys(PROVIDER_FACTORIES).join(', ')}`);
  }
  return factory();
}

export function listProviders(): string[] {
  return Object.keys(PROVIDER_FACTORIES);
}

export function registerProvider(name: string, factory: ProviderFactory): void {
  PROVIDER_FACTORIES[name] = factory;
}
