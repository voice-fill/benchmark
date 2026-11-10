import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transcribeMock = vi.hoisted(() => vi.fn());

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  experimental_transcribe: transcribeMock,
}));

const { getProvider, getAvailableProviders, listProviders } = await import('../src/providers/index.js');
const { COST_PER_MINUTE } = await import('../src/metrics/cost.js');

const NEW_PROVIDERS = [
  {
    name: 'openai-gpt4o-transcribe',
    envKey: 'OPENAI_API_KEY',
    modelId: 'gpt-4o-transcribe',
    providerOptions: { openai: { language: 'sl' } },
    costPerMinute: 0.006,
  },
  {
    name: 'elevenlabs-scribe-v2',
    envKey: 'ELEVENLABS_API_KEY',
    modelId: 'scribe_v2',
    providerOptions: { elevenlabs: { languageCode: 'sl' } },
    costPerMinute: 0.22 / 60,
  },
  {
    name: 'groq-whisper-large-v3',
    envKey: 'GROQ_API_KEY',
    modelId: 'whisper-large-v3',
    providerOptions: { groq: { language: 'sl' } },
    costPerMinute: 0.111 / 60,
  },
] as const;

const ALL_ENV_KEYS = ['OPENAI_API_KEY', 'DEEPGRAM_API_KEY', 'ASSEMBLYAI_API_KEY', 'SONIOX_API_KEY',
  'ELEVENLABS_API_KEY', 'GROQ_API_KEY'];

describe.each(NEW_PROVIDERS)('$name', (provider) => {
  beforeEach(() => {
    vi.stubEnv(provider.envKey, 'test-key');
    transcribeMock.mockReset();
    transcribeMock.mockResolvedValue({ text: 'dober dan', durationInSeconds: 1.5 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is registered', () => {
    expect(listProviders()).toContain(provider.name);
  });

  it(`transcribes with model ${provider.modelId} and passes the language`, async () => {
    const result = await getProvider(provider.name).transcribe(Buffer.from('audio'), { language: 'sl' });

    const call = transcribeMock.mock.calls[0][0];
    expect(call.model.modelId).toBe(provider.modelId);
    expect(call.providerOptions).toEqual(provider.providerOptions);
    expect(result).toEqual({ text: 'dober dan', durationInSeconds: 1.5 });
  });

  it(`is only available when ${provider.envKey} is set`, () => {
    for (const key of ALL_ENV_KEYS) vi.stubEnv(key, '');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(getAvailableProviders().map((p) => p.name)).not.toContain(provider.name);

    vi.stubEnv(provider.envKey, 'test-key');
    expect(getAvailableProviders().map((p) => p.name)).toContain(provider.name);
  });

  it('has a cost per minute', () => {
    expect(COST_PER_MINUTE[provider.name]).toBeCloseTo(provider.costPerMinute, 6);
  });
});
