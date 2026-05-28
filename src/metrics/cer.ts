export interface CerResult {
  cer: number;
  substitutions: number;
  insertions: number;
  deletions: number;
  referenceLength: number;
}

export function computeCer(reference: string, hypothesis: string): CerResult {
  const ref = [...reference];
  const hyp = [...hypothesis];
  const n = ref.length;
  const m = hyp.length;

  if (n === 0 && m === 0) {
    return { cer: 0, substitutions: 0, insertions: 0, deletions: 0, referenceLength: 0 };
  }
  if (n === 0) {
    return { cer: Infinity, substitutions: 0, insertions: m, deletions: 0, referenceLength: 0 };
  }

  const prev = new Uint32Array(m + 1);
  const curr = new Uint32Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      }
    }
    prev.set(curr);
  }

  const distance = curr[m];

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const ops: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const OP_SUB = 1, OP_INS = 2, OP_DEL = 3, OP_OK = 4;

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) ops[i][0] = OP_DEL;
  for (let j = 1; j <= m; j++) ops[0][j] = OP_INS;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
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

  let substitutions = 0, insertions = 0, deletions = 0;
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const op = ops[i][j];
    if (op === OP_OK || op === OP_SUB) {
      if (op === OP_SUB) substitutions++;
      i--; j--;
    } else if (op === OP_DEL) {
      deletions++; i--;
    } else {
      insertions++; j--;
    }
  }

  return {
    cer: distance / n,
    substitutions,
    insertions,
    deletions,
    referenceLength: n,
  };
}
