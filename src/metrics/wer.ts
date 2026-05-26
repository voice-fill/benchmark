export interface WerResult {
  wer: number;
  substitutions: number;
  insertions: number;
  deletions: number;
  referenceLength: number;
}

export function computeWer(reference: string, hypothesis: string): WerResult {
  const refWords = reference.trim() === '' ? [] : reference.trim().split(/\s+/);
  const hypWords = hypothesis.trim() === '' ? [] : hypothesis.trim().split(/\s+/);
  const n = refWords.length;
  const m = hypWords.length;

  if (n === 0 && m === 0) {
    return { wer: 0, substitutions: 0, insertions: 0, deletions: 0, referenceLength: 0 };
  }
  if (n === 0) {
    return { wer: Infinity, substitutions: 0, insertions: m, deletions: 0, referenceLength: 0 };
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const ops: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  const OP_SUB = 1;
  const OP_INS = 2;
  const OP_DEL = 3;
  const OP_OK = 4;

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) ops[i][0] = OP_DEL;
  for (let j = 1; j <= m; j++) ops[0][j] = OP_INS;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        ops[i][j] = OP_OK;
      } else {
        const sub = dp[i - 1][j - 1] + 1;
        const ins = dp[i][j - 1] + 1;
        const del = dp[i - 1][j] + 1;
        const min = Math.min(sub, ins, del);
        dp[i][j] = min;
        if (min === sub) ops[i][j] = OP_SUB;
        else if (min === del) ops[i][j] = OP_DEL;
        else ops[i][j] = OP_INS;
      }
    }
  }

  let substitutions = 0;
  let insertions = 0;
  let deletions = 0;
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    const op = ops[i][j];
    if (op === OP_OK || op === OP_SUB) {
      if (op === OP_SUB) substitutions++;
      i--;
      j--;
    } else if (op === OP_DEL) {
      deletions++;
      i--;
    } else {
      insertions++;
      j--;
    }
  }

  return {
    wer: (substitutions + insertions + deletions) / n,
    substitutions,
    insertions,
    deletions,
    referenceLength: n,
  };
}
