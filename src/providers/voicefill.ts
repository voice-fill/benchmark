import { createOpenAI } from '@ai-sdk/openai';
import { createDeepgram } from '@ai-sdk/deepgram';
import { createAssemblyAI } from '@ai-sdk/assemblyai';
import { createSoniox } from '@soniox/vercel-ai-sdk-provider';
import type { TranscriptionModel, JSONValue } from 'ai';
import { experimental_transcribe } from 'ai';
import type { BenchmarkProvider, TranscribeResult } from './types.js';

type ProviderOptions = Record<string, Record<string, JSONValue | undefined>>;

function makeProvider(
  name: string,
  createModel: () => TranscriptionModel,
  buildOptions: (language?: string) => ProviderOptions | undefined,
): BenchmarkProvider {
  return {
    name,
    async transcribe(audio: Buffer, options: { language?: string }): Promise<TranscribeResult> {
      const model = createModel();
      const providerOptions = buildOptions(options.language);
      const result = await experimental_transcribe({
        model,
        audio,
        ...(providerOptions && { providerOptions }),
      });
      return {
        text: result.text,
        durationInSeconds: result.durationInSeconds,
      };
    },
  };
}

export function createOpenAIWhisperProvider(): BenchmarkProvider {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return makeProvider(
    'openai-whisper',
    () => openai.transcription('whisper-1'),
    (language) => language ? { openai: { language } } : undefined,
  );
}

export function createDeepgramProvider(): BenchmarkProvider {
  const deepgram = createDeepgram({ apiKey: process.env.DEEPGRAM_API_KEY! });
  return makeProvider(
    'deepgram-nova3',
    () => deepgram.transcription('nova-3'),
    (language) => language ? { deepgram: { language } } : undefined,
  );
}

export function createAssemblyAIProvider(): BenchmarkProvider {
  const assemblyai = createAssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
  return makeProvider(
    'assemblyai-best',
    () => assemblyai.transcription('best'),
    (language) => language ? { assemblyai: { languageCode: language } } : undefined,
  );
}

export function createSonioxProvider(): BenchmarkProvider {
  const soniox = createSoniox({ apiKey: process.env.SONIOX_API_KEY! });
  return makeProvider(
    'soniox-stt',
    () => soniox.transcription('soniox'),
    (language) => language ? { soniox: { language } } : undefined,
  );
}
