export const COST_PER_MINUTE: Record<string, number> = {
  'openai-whisper': 0.006,
  'deepgram-nova3': 0.0043,
  'assemblyai-best': 0.006,
  'soniox-stt': 0.004,
  'elevenlabs-scribe': 0.004,
  'azure-speech': 0.017,
  'google-speech': 0.016,
  'aws-transcribe': 0.024,
};

export function calculateCost(provider: string, durationSeconds: number): number | undefined {
  const rate = COST_PER_MINUTE[provider];
  if (rate === undefined) return undefined;
  return rate * (durationSeconds / 60);
}
