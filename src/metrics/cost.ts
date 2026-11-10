export const COST_PER_MINUTE: Record<string, number> = {
  'openai-whisper': 0.006,
  'deepgram-nova3': 0.0043,
  'assemblyai-best': 0.006,
  'soniox-stt': 0.004,
  'elevenlabs-scribe-v2': 0.22 / 60,
  'openai-gpt4o-transcribe': 0.006,
  'groq-whisper-large-v3': 0.111 / 60,
  'azure-speech': 0.017,
  'google-speech': 0.016,
  'aws-transcribe': 0.024,
};

export function calculateCost(provider: string, durationSeconds: number): number | undefined {
  const rate = COST_PER_MINUTE[provider];
  if (rate === undefined) return undefined;
  return rate * (durationSeconds / 60);
}
