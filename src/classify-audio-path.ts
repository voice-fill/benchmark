import path from 'node:path';

export type Condition = 'clean' | 'noisy' | 'dialect';

export interface AudioClassification {
  condition: Condition | null;
  dialect: string | null;
}

const CONDITIONS: readonly Condition[] = ['clean', 'noisy', 'dialect'];

function isCondition(value: string): value is Condition {
  return (CONDITIONS as readonly string[]).includes(value);
}

export function classifyAudioPath(audioPath: string): AudioClassification {
  const dir = path.basename(path.dirname(audioPath));
  const condition = isCondition(dir) ? dir : null;
  if (condition !== 'dialect') return { condition, dialect: null };

  const baseName = path.basename(audioPath, path.extname(audioPath));
  const dialect = baseName.match(/-([a-z]+)$/)?.[1] ?? null;
  return { condition, dialect };
}
