export interface TranscribeResult {
  text: string;
  durationInSeconds?: number;
}

export interface BenchmarkProvider {
  name: string;
  transcribe(audio: Buffer, options: { language?: string }): Promise<TranscribeResult>;
}
